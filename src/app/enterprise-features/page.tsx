"use client"

import React, { useState } from "react"
import { ProtectedLayout } from "@/components/layouts/protected-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Command,
  Users,
  Shield,
  Sparkles,
  Crown,
  Zap,
  Target,
  CheckCircle,
  ArrowRight,
  Play,
  Settings,
  Lock,
  Activity,
  Brain,
  BarChart3,
  Bell
} from "lucide-react"

import { OnboardingTour } from "@/components/enterprise/onboarding-tour"
import { AccessControlProvider, ProtectedFeature, UserProfileCard, PermissionsMatrix, SecuritySettings } from "@/components/enterprise/access-control"

export default function EnterpriseFeatures() {
  const [activeTab, setActiveTab] = useState("overview")
  const [showOnboarding, setShowOnboarding] = useState(false)

  const features = [
    {
      id: "command-palette",
      name: "Command Palette",
      description: "Power user interface for instant access to any platform function",
      icon: Command,
      status: "live",
      keyFeatures: [
        "Global keyboard shortcut (Ctrl+K)",
        "Fuzzy search across all features",
        "Category-based filtering",
        "Recent commands tracking",
        "Keyboard navigation support"
      ],
      benefits: [
        "Increased productivity",
        "Faster navigation",
        "Reduced clicks",
        "Power user experience"
      ]
    },
    {
      id: "onboarding-tour",
      name: "Interactive Onboarding",
      description: "Guided tour system for new users to learn platform features",
      icon: Target,
      status: "live",
      keyFeatures: [
        "Step-by-step guided tour",
        "Interactive feature highlights",
        "Progress tracking",
        "Keyboard shortcuts",
        "Skippable and resumable"
      ],
      benefits: [
        "Reduced learning curve",
        "Better user adoption",
        "Self-service support",
        "Feature discovery"
      ]
    },
    {
      id: "access-control",
      name: "Role-Based Access Control",
      description: "Enterprise-grade security with granular permission management",
      icon: Shield,
      status: "live",
      keyFeatures: [
        "Role-based permissions",
        "Feature-level access control",
        "Audit logging",
        "Multi-tenant support",
        "Security monitoring"
      ],
      benefits: [
        "Enhanced security",
        "Compliance readiness",
        "Data protection",
        "Administrative control"
      ]
    }
  ]

  const roles = [
    {
      name: "Administrator",
      icon: Crown,
      color: "text-red-600 bg-red-50",
      permissions: "Full platform access",
      description: "Complete system control and user management"
    },
    {
      name: "Manager", 
      icon: Users,
      color: "text-blue-600 bg-blue-50",
      permissions: "Campaign and analytics management",
      description: "Campaign creation and performance optimization"
    },
    {
      name: "Analyst",
      icon: BarChart3,
      color: "text-green-600 bg-green-50", 
      permissions: "Analytics and reporting",
      description: "Data analysis and report generation"
    },
    {
      name: "Viewer",
      icon: Activity,
      color: "text-gray-600 bg-gray-50",
      permissions: "Read-only access",
      description: "View dashboards and basic metrics"
    }
  ]

  return (
    <AccessControlProvider>
      <ProtectedLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h1 className="text-3xl font-bold tracking-tight">Enterprise Features</h1>
              <Badge variant="secondary" className="text-xs">
                <Crown className="w-3 h-3 mr-1" />
                Phase 3 Complete
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Advanced enterprise capabilities including command palette, onboarding, and access control
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Command className="w-5 h-5 text-blue-600" />
                  <div>
                    <div className="text-2xl font-bold">20+</div>
                    <div className="text-sm text-muted-foreground">Commands</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="text-2xl font-bold">10</div>
                    <div className="text-sm text-muted-foreground">Tour Steps</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <div>
                    <div className="text-2xl font-bold">4</div>
                    <div className="text-sm text-muted-foreground">Role Types</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-orange-600" />
                  <div>
                    <div className="text-2xl font-bold">11</div>
                    <div className="text-sm text-muted-foreground">Permissions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full max-w-2xl grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
                <TabsTrigger value="access-control">Access Control</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
              </TabsList>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOnboarding(true)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Tour
                </Button>
              </div>
            </div>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {features.map((feature) => {
                  const IconComponent = feature.icon
                  return (
                    <Card key={feature.id} className="relative overflow-hidden">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <IconComponent className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{feature.name}</CardTitle>
                              <CardDescription className="mt-1">
                                {feature.description}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant="default" className="text-xs">
                            {feature.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Key Features:</h4>
                            <div className="space-y-1">
                              {feature.keyFeatures.map((keyFeature) => (
                                <div key={keyFeature} className="flex items-center space-x-2 text-sm">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                  <span>{keyFeature}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium mb-2">Benefits:</h4>
                            <div className="grid grid-cols-2 gap-1">
                              {feature.benefits.map((benefit) => (
                                <Badge key={benefit} variant="outline" className="text-xs">
                                  {benefit}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Role-Based Access Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Role-Based Access Control
                  </CardTitle>
                  <CardDescription>
                    Four-tier permission system for enterprise security
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {roles.map((role) => {
                      const IconComponent = role.icon
                      return (
                        <div key={role.name} className={`p-4 rounded-lg border ${role.color}`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <IconComponent className="w-5 h-5" />
                            <span className="font-semibold">{role.name}</span>
                          </div>
                          <p className="text-sm mb-1">{role.permissions}</p>
                          <p className="text-xs opacity-75">{role.description}</p>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="onboarding" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="w-5 h-5 mr-2" />
                    Interactive Onboarding Tour
                  </CardTitle>
                  <CardDescription>
                    Guided introduction to platform features for new users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h4 className="font-semibold">Tour Highlights</h4>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>10-step guided walkthrough</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>Interactive feature spotlights</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>Keyboard navigation support</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span>Progress tracking</span>
                          </li>
                        </ul>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="font-semibold">Tour Categories</h4>
                        <div className="space-y-2">
                          <Badge variant="outline" className="mr-2">Navigation</Badge>
                          <Badge variant="outline" className="mr-2">Features</Badge>
                          <Badge variant="outline" className="mr-2">Advanced</Badge>
                          <Badge variant="outline" className="mr-2">Tips</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <Button onClick={() => setShowOnboarding(true)}>
                        <Play className="w-4 h-4 mr-2" />
                        Start Interactive Tour
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access-control" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <UserProfileCard />
                <PermissionsMatrix />
              </div>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <SecuritySettings />
            </TabsContent>
          </Tabs>

          {/* Achievement Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sparkles className="w-5 h-5 mr-2" />
                Phase 3 Achievements
              </CardTitle>
              <CardDescription>
                Enterprise features successfully implemented and deployed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-600">✅ Command Palette</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Global keyboard shortcuts (Ctrl+K)</li>
                    <li>• 20+ searchable commands</li>
                    <li>• Category-based filtering</li>
                    <li>• Recent commands tracking</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-green-600">✅ Interactive Onboarding</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• 10-step guided tour</li>
                    <li>• Feature highlighting</li>
                    <li>• Progress tracking</li>
                    <li>• Keyboard navigation</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-purple-600">✅ Access Control</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Role-based permissions</li>
                    <li>• 4-tier access levels</li>
                    <li>• Security monitoring</li>
                    <li>• Audit logging</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Onboarding Tour */}
        <OnboardingTour
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          onComplete={() => {
            setShowOnboarding(false)
            // You could save completion status here
          }}
        />
      </ProtectedLayout>
    </AccessControlProvider>
  )
}