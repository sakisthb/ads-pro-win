"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Search,
  Zap,
  BarChart3,
  Brain,
  Bell,
  Activity,
  Settings,
  Users,
  Target,
  DollarSign,
  TrendingUp,
  Calendar,
  FileText,
  Download,
  Upload,
  Plus,
  Edit,
  Trash2,
  Copy,
  Share2,
  ExternalLink,
  Command,
  ArrowRight,
  Clock,
  Star,
  Filter,
  RefreshCw,
  Play,
  Pause,
  Archive,
  Tag,
  Folder,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CommandItem {
  id: string
  title: string
  description: string
  category: string
  keywords: string[]
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  action: () => void
  priority: number
  recent?: boolean
}

interface CommandCategory {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const categories: CommandCategory[] = [
  { id: "navigation", name: "Navigation", icon: Target, color: "text-blue-600" },
  { id: "analytics", name: "Analytics", icon: BarChart3, color: "text-green-600" },
  { id: "ai", name: "AI & Insights", icon: Brain, color: "text-purple-600" },
  { id: "campaigns", name: "Campaigns", icon: Zap, color: "text-orange-600" },
  { id: "settings", name: "Settings", icon: Settings, color: "text-gray-600" },
  { id: "actions", name: "Actions", icon: Play, color: "text-red-600" }
]

const mockCommands: CommandItem[] = [
  // Navigation
  {
    id: "nav_dashboard",
    title: "Go to Dashboard",
    description: "Navigate to the main dashboard",
    category: "navigation",
    keywords: ["dashboard", "home", "main", "overview"],
    icon: Activity,
    shortcut: "⌘D",
    action: () => console.log("Navigate to dashboard"),
    priority: 10,
    recent: true
  },
  {
    id: "nav_analytics",
    title: "Advanced Analytics",
    description: "Open the analytics hub",
    category: "navigation", 
    keywords: ["analytics", "data", "reports", "metrics"],
    icon: BarChart3,
    shortcut: "⌘A",
    action: () => console.log("Navigate to analytics"),
    priority: 9
  },
  {
    id: "nav_ai_insights",
    title: "AI Insights Center",
    description: "View AI predictions and recommendations",
    category: "navigation",
    keywords: ["ai", "insights", "predictions", "recommendations"],
    icon: Brain,
    shortcut: "⌘I",
    action: () => console.log("Navigate to AI insights"),
    priority: 8,
    recent: true
  },
  {
    id: "nav_notifications",
    title: "Notification Center",
    description: "Check alerts and notifications",
    category: "navigation",
    keywords: ["notifications", "alerts", "messages", "updates"],
    icon: Bell,
    action: () => console.log("Navigate to notifications"),
    priority: 7
  },

  // Analytics
  {
    id: "analytics_export",
    title: "Export Analytics Report",
    description: "Download current analytics data",
    category: "analytics",
    keywords: ["export", "download", "report", "data", "csv", "pdf"],
    icon: Download,
    shortcut: "⌘E",
    action: () => console.log("Export analytics"),
    priority: 8
  },
  {
    id: "analytics_filter",
    title: "Filter Analytics Data",
    description: "Apply filters to analytics dashboard", 
    category: "analytics",
    keywords: ["filter", "search", "date", "range", "segment"],
    icon: Filter,
    action: () => console.log("Filter analytics"),
    priority: 6
  },
  {
    id: "analytics_refresh",
    title: "Refresh Analytics",
    description: "Update analytics data to latest",
    category: "analytics",
    keywords: ["refresh", "update", "reload", "sync"],
    icon: RefreshCw,
    shortcut: "⌘R",
    action: () => console.log("Refresh analytics"),
    priority: 7,
    recent: true
  },

  // AI & Insights
  {
    id: "ai_generate",
    title: "Generate New Insights",
    description: "Run AI analysis for new recommendations",
    category: "ai",
    keywords: ["generate", "ai", "insights", "recommendations", "analysis"],
    icon: Brain,
    shortcut: "⌘G",
    action: () => console.log("Generate AI insights"),
    priority: 9
  },
  {
    id: "ai_optimize",
    title: "Auto-Optimize Campaigns",
    description: "Apply AI recommendations automatically",
    category: "ai",
    keywords: ["optimize", "auto", "campaigns", "apply", "recommendations"],
    icon: Zap,
    action: () => console.log("Auto-optimize"),
    priority: 8
  },
  {
    id: "ai_models",
    title: "Manage AI Models",
    description: "Configure and retrain AI models",
    category: "ai",
    keywords: ["models", "ai", "configure", "retrain", "machine learning"],
    icon: Settings,
    action: () => console.log("Manage AI models"),
    priority: 5
  },

  // Campaigns
  {
    id: "campaign_create",
    title: "Create New Campaign",
    description: "Start a new advertising campaign",
    category: "campaigns",
    keywords: ["create", "new", "campaign", "advertising", "start"],
    icon: Plus,
    shortcut: "⌘N",
    action: () => console.log("Create campaign"),
    priority: 9
  },
  {
    id: "campaign_pause",
    title: "Pause All Campaigns",
    description: "Emergency pause for all active campaigns",
    category: "campaigns",
    keywords: ["pause", "stop", "halt", "emergency", "all"],
    icon: Pause,
    action: () => console.log("Pause campaigns"),
    priority: 8
  },
  {
    id: "campaign_budget",
    title: "Adjust Campaign Budgets",
    description: "Modify budget allocation across campaigns",
    category: "campaigns",
    keywords: ["budget", "adjust", "allocation", "spending", "modify"],
    icon: DollarSign,
    action: () => console.log("Adjust budgets"),
    priority: 7
  },

  // Settings
  {
    id: "settings_account",
    title: "Account Settings",
    description: "Manage account preferences and profile",
    category: "settings",
    keywords: ["account", "profile", "settings", "preferences", "user"],
    icon: Users,
    action: () => console.log("Account settings"),
    priority: 6
  },
  {
    id: "settings_notifications",
    title: "Notification Settings",
    description: "Configure alerts and notification preferences",
    category: "settings",
    keywords: ["notifications", "alerts", "preferences", "configure", "email"],
    icon: Bell,
    action: () => console.log("Notification settings"),
    priority: 5
  },
  {
    id: "settings_api",
    title: "API Configuration",
    description: "Manage API keys and integrations",
    category: "settings",
    keywords: ["api", "keys", "integrations", "configure", "webhooks"],
    icon: Settings,
    action: () => console.log("API settings"),
    priority: 4
  },

  // Actions
  {
    id: "action_backup",
    title: "Backup Data",
    description: "Create a backup of all campaign data",
    category: "actions",
    keywords: ["backup", "export", "save", "data", "archive"],
    icon: Archive,
    action: () => console.log("Backup data"),
    priority: 6
  },
  {
    id: "action_share",
    title: "Share Dashboard",
    description: "Generate shareable link for dashboard",
    category: "actions",
    keywords: ["share", "link", "dashboard", "public", "export"],
    icon: Share2,
    action: () => console.log("Share dashboard"),
    priority: 5
  },
  {
    id: "action_support",
    title: "Contact Support",
    description: "Get help from our support team",
    category: "actions",
    keywords: ["support", "help", "contact", "assistance", "ticket"],
    icon: ExternalLink,
    action: () => console.log("Contact support"),
    priority: 4
  }
]

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredCommands = useMemo(() => {
    let commands = mockCommands

    // Filter by category if selected
    if (selectedCategory) {
      commands = commands.filter(cmd => cmd.category === selectedCategory)
    }

    // Filter by search query
    if (query.trim()) {
      const searchTerms = query.toLowerCase().split(" ")
      commands = commands.filter(cmd => {
        const searchableText = [
          cmd.title,
          cmd.description,
          ...cmd.keywords,
          cmd.category
        ].join(" ").toLowerCase()
        
        return searchTerms.every(term => searchableText.includes(term))
      })
    }

    // Sort by priority and recent usage
    return commands.sort((a, b) => {
      if (a.recent && !b.recent) return -1
      if (!a.recent && b.recent) return 1
      return b.priority - a.priority
    })
  }, [query, selectedCategory])

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredCommands])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1))
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break
        case "Enter":
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
            onClose()
          }
          break
        case "Escape":
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, selectedIndex, filteredCommands, onClose])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setSelectedCategory(null)
      setSelectedIndex(0)
    }
  }, [isOpen])

  const handleCommandSelect = (command: CommandItem) => {
    command.action()
    onClose()
  }

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(selectedCategory === categoryId ? null : categoryId)
    setQuery("")
    setSelectedIndex(0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="p-4 border-b">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Command className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Command Palette</h2>
                <p className="text-sm text-muted-foreground">
                  Type to search or browse by category
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          {/* Categories */}
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const IconComponent = category.icon
                const isSelected = selectedCategory === category.id
                const commandCount = mockCommands.filter(cmd => cmd.category === category.id).length
                
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className={cn(
                      "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    <IconComponent className="w-4 h-4" />
                    <span>{category.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {commandCount}
                    </Badge>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto max-h-96">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center">
                <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No commands found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or browse by category
                </p>
              </div>
            ) : (
              <div className="p-2">
                {filteredCommands.map((command, index) => {
                  const IconComponent = command.icon
                  const isSelected = index === selectedIndex
                  const category = categories.find(cat => cat.id === command.category)
                  
                  return (
                    <button
                      key={command.id}
                      onClick={() => handleCommandSelect(command)}
                      className={cn(
                        "w-full flex items-center space-x-3 p-3 rounded-lg text-left transition-colors",
                        isSelected
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium truncate">{command.title}</span>
                          {command.recent && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              Recent
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {command.description}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          {category && (
                            <Badge variant="outline" className="text-xs">
                              {category.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {command.shortcut && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {command.shortcut}
                          </Badge>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center space-x-4">
                <span>↑↓ Navigate</span>
                <span>⏎ Select</span>
                <span>Esc Close</span>
              </div>
              <span>{filteredCommands.length} commands</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}