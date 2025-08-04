"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Shield,
  ShieldCheck,
  ShieldX,
  Users,
  Settings,
  Crown,
  User,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types
type Role = "admin" | "manager" | "analyst" | "viewer"
type Permission = 
  | "campaigns.create" 
  | "campaigns.edit" 
  | "campaigns.delete" 
  | "campaigns.view"
  | "analytics.view" 
  | "analytics.export"
  | "ai.insights.view" 
  | "ai.optimize.auto"
  | "settings.manage" 
  | "users.manage"
  | "billing.manage"

interface User {
  id: string
  name: string
  email: string
  role: Role
  permissions: Permission[]
  isActive: boolean
  lastLogin?: Date
  organizationId: string
}

interface AccessControlContextType {
  user: User | null
  hasPermission: (permission: Permission) => boolean
  hasRole: (role: Role) => boolean
  isLoading: boolean
}

// Permission mappings
const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "campaigns.create", "campaigns.edit", "campaigns.delete", "campaigns.view",
    "analytics.view", "analytics.export",
    "ai.insights.view", "ai.optimize.auto",
    "settings.manage", "users.manage", "billing.manage"
  ],
  manager: [
    "campaigns.create", "campaigns.edit", "campaigns.view",
    "analytics.view", "analytics.export",
    "ai.insights.view", "ai.optimize.auto"
  ],
  analyst: [
    "campaigns.view",
    "analytics.view", "analytics.export",
    "ai.insights.view"
  ],
  viewer: [
    "campaigns.view",
    "analytics.view"
  ]
}

const roleConfig = {
  admin: {
    label: "Administrator",
    icon: Crown,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200"
  },
  manager: {
    label: "Manager", 
    icon: ShieldCheck,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  analyst: {
    label: "Analyst",
    icon: User,
    color: "text-green-600",
    bgColor: "bg-green-50", 
    borderColor: "border-green-200"
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200"
  }
}

// Mock user data
const mockUser: User = {
  id: "user_123",
  name: "John Doe",
  email: "john.doe@company.com",
  role: "manager",
  permissions: rolePermissions.manager,
  isActive: true,
  lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  organizationId: "org_456"
}

// Context
const AccessControlContext = createContext<AccessControlContextType>({
  user: null,
  hasPermission: () => false,
  hasRole: () => false,
  isLoading: true
})

// Provider
export function AccessControlProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading user data
    const loadUser = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setUser(mockUser)
      setIsLoading(false)
    }
    
    loadUser()
  }, [])

  const hasPermission = (permission: Permission): boolean => {
    return user?.permissions.includes(permission) ?? false
  }

  const hasRole = (role: Role): boolean => {
    return user?.role === role
  }

  return (
    <AccessControlContext.Provider value={{ user, hasPermission, hasRole, isLoading }}>
      {children}
    </AccessControlContext.Provider>
  )
}

// Hook
export function useAccessControl() {
  const context = useContext(AccessControlContext)
  if (!context) {
    throw new Error("useAccessControl must be used within AccessControlProvider")
  }
  return context
}

// Components
interface ProtectedFeatureProps {
  permission?: Permission
  role?: Role
  children: React.ReactNode
  fallback?: React.ReactNode
  showError?: boolean
}

export function ProtectedFeature({ 
  permission, 
  role, 
  children, 
  fallback, 
  showError = false 
}: ProtectedFeatureProps) {
  const { hasPermission, hasRole, isLoading } = useAccessControl()

  if (isLoading) {
    return <div className="h-8 w-24 bg-muted animate-pulse rounded" />
  }

  const hasAccess = permission ? hasPermission(permission) : role ? hasRole(role) : false

  if (!hasAccess) {
    if (showError) {
      return (
        <div className="p-4 border border-dashed border-destructive/20 rounded-lg bg-destructive/5">
          <div className="flex items-center space-x-2 text-destructive">
            <ShieldX className="w-4 h-4" />
            <span className="text-sm">Access denied - insufficient permissions</span>
          </div>
        </div>
      )
    }
    return fallback || null
  }

  return <>{children}</>
}

export function UserProfileCard() {
  const { user, isLoading } = useAccessControl()

  if (isLoading || !user) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const config = roleConfig[user.role]
  const IconComponent = config.icon

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <IconComponent className={cn("w-5 h-5", config.color)} />
            </div>
            <div>
              <CardTitle className="text-base">{user.name}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={user.isActive ? "default" : "secondary"}>
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline" className={cn(config.color, config.bgColor)}>
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Last login: </span>
            <span>{user.lastLogin?.toLocaleDateString()} at {user.lastLogin?.toLocaleTimeString()}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">Permissions: </span>
            <span className="font-medium">{user.permissions.length} granted</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PermissionsMatrix() {
  const { user } = useAccessControl()

  if (!user) return null

  const allPermissions: Permission[] = [
    "campaigns.create", "campaigns.edit", "campaigns.delete", "campaigns.view",
    "analytics.view", "analytics.export",
    "ai.insights.view", "ai.optimize.auto",
    "settings.manage", "users.manage", "billing.manage"
  ]

  const permissionCategories = {
    campaigns: ["campaigns.create", "campaigns.edit", "campaigns.delete", "campaigns.view"],
    analytics: ["analytics.view", "analytics.export"],
    ai: ["ai.insights.view", "ai.optimize.auto"],
    admin: ["settings.manage", "users.manage", "billing.manage"]
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="w-5 h-5 mr-2" />
          Permission Matrix
        </CardTitle>
        <CardDescription>
          Current permissions for {user.name} ({roleConfig[user.role].label})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(permissionCategories).map(([category, permissions]) => (
            <div key={category} className="space-y-2">
              <h4 className="text-sm font-semibold capitalize">{category}</h4>
              <div className="grid grid-cols-1 gap-2">
                {permissions.map((permission) => {
                  const hasPermission = user.permissions.includes(permission as Permission)
                  return (
                    <div key={permission} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">{permission}</span>
                      <div className="flex items-center space-x-2">
                        {hasPermission ? (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Granted
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            <ShieldX className="w-3 h-3 mr-1" />
                            Denied
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SecuritySettings() {
  const { user } = useAccessControl()
  const [auditLogs, setAuditLogs] = useState([
    {
      id: "1",
      action: "Campaign Created",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      details: "Created 'Holiday Sale 2025' campaign"
    },
    {
      id: "2", 
      action: "Analytics Exported",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      details: "Exported Q4 performance report"
    },
    {
      id: "3",
      action: "AI Optimization Applied",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
      details: "Auto-optimized budget allocation"
    }
  ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            Security Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span className="font-medium">Two-Factor Auth</span>
              </div>
              <p className="text-sm text-muted-foreground">Enabled</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="font-medium">Session Security</span>
              </div>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span className="font-medium">Role-Based Access</span>
              </div>
              <p className="text-sm text-muted-foreground">Configured</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Recent security and access events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="font-medium text-sm">{log.action}</div>
                  <div className="text-xs text-muted-foreground">{log.details}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {log.timestamp.toLocaleDateString()} {log.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}