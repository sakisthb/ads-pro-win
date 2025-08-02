"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Bell,
  BellRing,
  AlertTriangle,
  CheckCircle,
  Info,
  Zap,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  Calendar,
  Clock,
  X,
  Check,
  Archive,
  Settings,
  Filter,
  Search,
  MoreHorizontal,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Notification {
  id: string
  type: "alert" | "info" | "success" | "warning" | "update"
  title: string
  message: string
  priority: "critical" | "high" | "medium" | "low"
  category: string
  isRead: boolean
  timestamp: Date
  actionable: boolean
  actions?: NotificationAction[]
  metadata?: any
}

interface NotificationAction {
  id: string
  label: string
  type: "primary" | "secondary" | "destructive"
  url?: string
  action?: () => void
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "alert",
    title: "Campaign Budget Alert",
    message: "Your 'Holiday Sale 2025' campaign has reached 90% of its daily budget limit.",
    priority: "critical",
    category: "Budget Management",
    isRead: false,
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    actionable: true,
    actions: [
      { id: "increase", label: "Increase Budget", type: "primary" },
      { id: "pause", label: "Pause Campaign", type: "destructive" }
    ],
    metadata: { campaignId: "camp_123", budgetUsed: 90, dailyLimit: 1000 }
  },
  {
    id: "2",
    type: "warning",
    title: "Performance Drop Detected",
    message: "CTR for Google Ads campaign decreased by 23% compared to last week. Review needed.",
    priority: "high",
    category: "Performance Monitoring",
    isRead: false,
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    actionable: true,
    actions: [
      { id: "review", label: "Review Campaign", type: "primary" },
      { id: "optimize", label: "Auto-Optimize", type: "secondary" }
    ],
    metadata: { campaignId: "camp_456", ctrDrop: 23, platform: "Google" }
  },
  {
    id: "3",
    type: "success",
    title: "Goal Achieved!",
    message: "Your monthly ROAS target of 4.5x has been reached 5 days early. Congratulations!",
    priority: "medium",
    category: "Goal Tracking",
    isRead: false,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    actionable: true,
    actions: [
      { id: "share", label: "Share Success", type: "secondary" },
      { id: "details", label: "View Details", type: "primary" }
    ],
    metadata: { currentRoas: 4.7, targetRoas: 4.5, achievedEarly: 5 }
  },
  {
    id: "4",
    type: "info",
    title: "New AI Insights Available",
    message: "3 new optimization recommendations have been generated based on your latest campaign data.",
    priority: "medium",
    category: "AI Insights",
    isRead: true,
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
    actionable: true,
    actions: [
      { id: "view", label: "View Insights", type: "primary" }
    ],
    metadata: { insightCount: 3, estimatedImpact: 12500 }
  },
  {
    id: "5",
    type: "update",
    title: "Weekly Performance Report",
    message: "Your weekly analytics report is ready. Total revenue increased by 18% compared to last week.",
    priority: "low",
    category: "Reports",
    isRead: true,
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    actionable: true,
    actions: [
      { id: "download", label: "Download Report", type: "secondary" },
      { id: "schedule", label: "Schedule Next", type: "secondary" }
    ],
    metadata: { revenueIncrease: 18, period: "weekly" }
  },
  {
    id: "6",
    type: "alert",
    title: "Competitor Activity Alert",
    message: "Competitor 'BrandX' launched a new campaign targeting your key keywords. Monitor recommended.",
    priority: "high",
    category: "Competitive Intelligence",
    isRead: false,
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    actionable: true,
    actions: [
      { id: "analyze", label: "Analyze Threat", type: "primary" },
      { id: "adjust", label: "Adjust Bids", type: "secondary" }
    ],
    metadata: { competitor: "BrandX", keywordsAffected: 12, threatLevel: "medium" }
  }
]

const notificationConfig = {
  alert: {
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200"
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200"
  },
  success: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200"
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  update: {
    icon: BellRing,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  }
}

const priorityConfig = {
  critical: { color: "text-red-600", label: "Critical" },
  high: { color: "text-orange-600", label: "High" },
  medium: { color: "text-yellow-600", label: "Medium" },
  low: { color: "text-green-600", label: "Low" }
}

function NotificationItem({ 
  notification, 
  onMarkRead, 
  onMarkUnread, 
  onArchive,
  onAction 
}: { 
  notification: Notification
  onMarkRead: (id: string) => void
  onMarkUnread: (id: string) => void
  onArchive: (id: string) => void
  onAction: (notificationId: string, actionId: string) => void
}) {
  const config = notificationConfig[notification.type]
  const priorityConf = priorityConfig[notification.priority]
  const IconComponent = config.icon

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  return (
    <Card className={cn(
      "transition-all hover:shadow-sm",
      !notification.isRead && "bg-muted/20 border-l-4",
      !notification.isRead && config.borderColor
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <IconComponent className={cn("w-4 h-4", config.color)} />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold text-sm truncate">{notification.title}</h4>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center space-x-2 text-xs">
                <Badge variant="outline" className={cn(priorityConf.color)}>
                  {priorityConf.label}
                </Badge>
                <span className="text-muted-foreground">{notification.category}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{formatTimestamp(notification.timestamp)}</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {notification.isRead ? (
                <DropdownMenuItem onClick={() => onMarkUnread(notification.id)}>
                  <Bell className="w-4 h-4 mr-2" />
                  Mark as unread
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onMarkRead(notification.id)}>
                  <Check className="w-4 h-4 mr-2" />
                  Mark as read
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onArchive(notification.id)}>
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in new tab
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {notification.message}
        </p>
        
        {notification.actionable && notification.actions && (
          <div className="flex items-center space-x-2 pt-2 border-t">
            {notification.actions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.type === "primary" ? "default" : action.type === "destructive" ? "destructive" : "outline"}
                onClick={() => onAction(notification.id, action.id)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [filter, setFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    )
  }

  const markAsUnread = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, isRead: false } : notif
      )
    )
  }

  const archiveNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, isRead: true }))
    )
  }

  const handleAction = (notificationId: string, actionId: string) => {
    console.log(`Action ${actionId} triggered for notification ${notificationId}`)
    // Handle notification actions here
  }

  const filteredNotifications = notifications.filter(notif => {
    const matchesFilter = filter === "all" || 
      (filter === "unread" && !notif.isRead) ||
      (filter === "priority" && (notif.priority === "critical" || notif.priority === "high")) ||
      notif.type === filter

    const matchesSearch = searchQuery === "" ||
      notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notif.category.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesFilter && matchesSearch
  })

  const unreadCount = notifications.filter(n => !n.isRead).length
  const criticalCount = notifications.filter(n => n.priority === "critical").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notification Center</h2>
          <p className="text-muted-foreground">
            Stay updated with alerts, insights, and system notifications
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{notifications.length}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BellRing className="w-5 h-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{unreadCount}</div>
                <div className="text-sm text-muted-foreground">Unread</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{criticalCount}</div>
                <div className="text-sm text-muted-foreground">Critical</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">
                  {notifications.filter(n => n.actionable).length}
                </div>
                <div className="text-sm text-muted-foreground">Actionable</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Filter:</span>
          {["all", "unread", "priority", "alert", "warning", "success", "info"].map((filterType) => (
            <Button
              key={filterType}
              variant={filter === filterType ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(filterType)}
            >
              {filterType === "all" ? "All" : filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notifications found</h3>
              <p className="text-muted-foreground">
                {searchQuery ? "Try adjusting your search terms." : "You're all caught up!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={markAsRead}
              onMarkUnread={markAsUnread}
              onArchive={archiveNotification}
              onAction={handleAction}
            />
          ))
        )}
      </div>
    </div>
  )
}