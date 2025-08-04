"use client"

import React from "react"
import { Bell, Search, RefreshCw, Download, Zap, Settings, Command } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"

interface ProfessionalNavbarProps {
  onCommandPaletteOpen?: () => void
}

export function ProfessionalNavbar({ onCommandPaletteOpen }: ProfessionalNavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-4 h-4" />
        </div>
        
        {/* Search */}
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns, analytics..."
              className="pl-8 bg-background/50 backdrop-blur"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onCommandPaletteOpen}
            className="h-8 px-2 gap-1"
            title="Open Command Palette (Ctrl+K)"
          >
            <Command className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">⌘K</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Zap className="h-4 w-4" />
          </Button>
          
          <Separator orientation="vertical" className="mx-2 h-4" />
          
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 relative">
                <Bell className="h-4 w-4" />
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
                >
                  3
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="p-4">
                <h4 className="font-semibold">Notifications</h4>
                <p className="text-sm text-muted-foreground">
                  You have 3 unread notifications
                </p>
              </div>
              <Separator />
              <DropdownMenuItem className="p-4">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Campaign Performance Alert</p>
                  <p className="text-xs text-muted-foreground">
                    Your Facebook campaign is performing 23% below target
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-4">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">Budget Threshold Reached</p>
                  <p className="text-xs text-muted-foreground">
                    Google Ads campaign has reached 80% of daily budget
                  </p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-4">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">AI Optimization Ready</p>
                  <p className="text-xs text-muted-foreground">
                    New optimization suggestions available
                  </p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Settings */}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}