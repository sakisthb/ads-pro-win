"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Target,
  BarChart3,
  Brain,
  Bell,
  Activity,
  Command,
  Zap,
  Users,
  CheckCircle,
  Play,
  Pause,
  RotateCcw
} from "lucide-react"
import { cn } from "@/lib/utils"

interface TourStep {
  id: string
  title: string
  description: string
  content: string
  target?: string
  position?: "top" | "bottom" | "left" | "right" | "center"
  icon: React.ComponentType<{ className?: string }>
  category: "navigation" | "features" | "advanced" | "tips"
  optional?: boolean
}

interface OnboardingTourProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
  startStep?: number
}

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to Ads Pro Enterprise!",
    description: "Let's take a quick tour of your new AI-powered marketing platform",
    content: "This comprehensive platform provides enterprise-grade advertising analytics, AI-powered insights, and automated optimization tools. We'll guide you through the key features to get you started.",
    position: "center",
    icon: Sparkles,
    category: "navigation"
  },
  {
    id: "sidebar",
    title: "Navigation Sidebar",
    description: "Your command center for accessing all platform features",
    content: "The sidebar contains all major sections: Dashboard, Analytics, AI Insights, Campaigns, and Settings. Click the collapse button to save space when needed.",
    target: "[data-sidebar]",
    position: "right",
    icon: Target,
    category: "navigation"
  },
  {
    id: "command_palette",
    title: "Command Palette",
    description: "Power user feature for instant access to any function",
    content: "Press Ctrl+K (or Cmd+K on Mac) to open the command palette. Search for any feature, campaign, or action. This is the fastest way to navigate the platform.",
    target: "[data-command-trigger]",
    position: "bottom",
    icon: Command,
    category: "features"
  },
  {
    id: "performance_dashboard",
    title: "Performance Dashboard",
    description: "Real-time monitoring of system and campaign health",
    content: "Monitor API response times, error rates, and system performance. Color-coded indicators show health status at a glance. Auto-refreshes every 30 seconds.",
    icon: Activity,
    category: "features"
  },
  {
    id: "analytics_hub",
    title: "Advanced Analytics",
    description: "Multi-dimensional analysis with attribution modeling",
    content: "Dive deep into your data with funnel analysis, channel attribution, and campaign performance metrics. Export reports and filter by date ranges.",
    icon: BarChart3,
    category: "features"
  },
  {
    id: "ai_insights",
    title: "AI Insights Center",
    description: "Predictive analytics and intelligent recommendations",
    content: "AI-powered predictions for revenue, budget optimization suggestions, and anomaly detection. Each insight includes confidence scores and revenue impact estimates.",
    icon: Brain,
    category: "advanced"
  },
  {
    id: "notifications",
    title: "Notification Center",
    description: "Smart alerts and actionable notifications",
    content: "Stay informed with priority-based notifications. Get alerts for campaign performance, budget thresholds, and optimization opportunities. Take action directly from notifications.",
    icon: Bell,
    category: "features"
  },
  {
    id: "quick_actions",
    title: "Quick Actions",
    description: "One-click access to common tasks",
    content: "The top navigation bar provides quick access to refresh data, download reports, and trigger optimizations. Hover over icons to see keyboard shortcuts.",
    target: "[data-quick-actions]",
    position: "bottom",
    icon: Zap,
    category: "tips"
  },
  {
    id: "ai_automation",
    title: "AI Automation",
    description: "Let AI optimize your campaigns automatically",
    content: "Enable auto-optimization for budget reallocation, bid adjustments, and audience targeting. AI learns from your performance data to make intelligent decisions.",
    icon: Brain,
    category: "advanced",
    optional: true
  },
  {
    id: "completion",
    title: "You're All Set!",
    description: "Start exploring your new marketing intelligence platform",
    content: "You now know the key features of Ads Pro Enterprise. Remember to use Ctrl+K for quick navigation, check notifications regularly, and leverage AI insights for better performance.",
    position: "center",
    icon: CheckCircle,
    category: "navigation"
  }
]

const categoryConfig = {
  navigation: { color: "bg-blue-500", label: "Navigation", textColor: "text-blue-600" },
  features: { color: "bg-green-500", label: "Features", textColor: "text-green-600" },
  advanced: { color: "bg-purple-500", label: "Advanced", textColor: "text-purple-600" },
  tips: { color: "bg-orange-500", label: "Tips", textColor: "text-orange-600" }
}

export function OnboardingTour({ isOpen, onClose, onComplete, startStep = 0 }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(startStep)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)

  const currentTourStep = tourSteps[currentStep]
  const progress = ((currentStep + 1) / tourSteps.length) * 100
  const isLastStep = currentStep === tourSteps.length - 1
  const isFirstStep = currentStep === 0

  const markStepCompleted = useCallback((stepId: string) => {
    setCompletedSteps(prev => {
      if (!prev.includes(stepId)) {
        return [...prev, stepId]
      }
      return prev
    })
  }, [])

  const goToNextStep = useCallback(() => {
    if (currentTourStep) {
      markStepCompleted(currentTourStep.id)
    }
    
    if (isLastStep) {
      onComplete?.()
      onClose()
    } else {
      setCurrentStep(prev => Math.min(prev + 1, tourSteps.length - 1))
    }
  }, [currentTourStep, isLastStep, markStepCompleted, onComplete, onClose])

  const goToPreviousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }, [])

  const skipTour = useCallback(() => {
    if (showSkipConfirm) {
      onClose()
    } else {
      setShowSkipConfirm(true)
      setTimeout(() => setShowSkipConfirm(false), 3000)
    }
  }, [showSkipConfirm, onClose])

  const restartTour = useCallback(() => {
    setCurrentStep(0)
    setCompletedSteps([])
    setIsPaused(false)
    setShowSkipConfirm(false)
  }, [])

  // Auto-advance for certain steps (optional)
  useEffect(() => {
    if (!isPaused && currentTourStep?.category === "tips") {
      const timer = setTimeout(goToNextStep, 5000)
      return () => clearTimeout(timer)
    }
  }, [currentStep, isPaused, currentTourStep, goToNextStep])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault()
          goToNextStep()
          break
        case "ArrowLeft":
          e.preventDefault()
          goToPreviousStep()
          break
        case "Escape":
          e.preventDefault()
          skipTour()
          break
        case "p":
        case "P":
          e.preventDefault()
          setIsPaused(prev => !prev)
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, goToNextStep, goToPreviousStep, skipTour])

  if (!currentTourStep) return null

  const categoryConf = categoryConfig[currentTourStep.category]
  const IconComponent = currentTourStep.icon

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="flex flex-col">
          {/* Header */}
          <div className="p-6 border-b">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={cn("p-2 rounded-lg", categoryConf.color.replace("bg-", "bg-"), "bg-opacity-10")}>
                  <IconComponent className={cn("w-5 h-5", categoryConf.textColor)} />
                </div>
                <div>
                  <Badge variant="outline" className="text-xs mb-1">
                    {categoryConf.label}
                  </Badge>
                  <h2 className="text-lg font-semibold">{currentTourStep.title}</h2>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPaused(!isPaused)}
                  className="h-8 w-8 p-0"
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipTour}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Step {currentStep + 1} of {tourSteps.length}</span>
                <span>{Math.round(progress)}% complete</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <div>
              <h3 className="font-medium text-sm text-muted-foreground mb-2">
                {currentTourStep.description}
              </h3>
              <p className="text-sm leading-relaxed">
                {currentTourStep.content}
              </p>
            </div>

            {currentTourStep.optional && (
              <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
                <div className="flex items-center space-x-2 text-sm">
                  <Badge variant="secondary" className="text-xs">Optional</Badge>
                  <span className="text-muted-foreground">This step is optional but recommended</span>
                </div>
              </div>
            )}

            {showSkipConfirm && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-destructive">Click skip again to exit the tour</span>
                  <Button variant="outline" size="sm" onClick={() => setShowSkipConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={restartTour}
                  disabled={isFirstStep}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Restart
                </Button>
                {!isFirstStep && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousStep}
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Previous
                  </Button>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={skipTour}
                >
                  Skip Tour
                </Button>
                <Button onClick={goToNextStep}>
                  {isLastStep ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Complete
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="mt-3 text-xs text-muted-foreground">
              <span>💡 Use arrow keys to navigate • Space to continue • P to pause • Esc to exit</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}