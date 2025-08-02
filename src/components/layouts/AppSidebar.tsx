'use client'

import { 
  Home, 
  Settings, 
  BarChart3,
  Target,
  Brain,
  Activity,
  Zap,
  RefreshCw,
  Download,
  TrendingUp,
  FileText,
  Sparkles,
  Eye,
  Users,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const handleRefreshData = () => {
    toast.success('Refreshing data...');
    // Add actual refresh logic here
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleExportData = () => {
    toast.info('Exporting data...');
    // Add actual export logic here
    setTimeout(() => {
      toast.success('Export completed!');
    }, 2000);
  };

  const handleQuickOptimize = () => {
    toast.info('Running optimization...');
    // Add actual optimization logic here
    setTimeout(() => {
      toast.success('Optimization completed!');
    }, 3000);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-gray-200 dark:border-gray-700">
      <SidebarContent className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Dashboard" isActive={isActive('/')} asChild>
                  <Link href="/">
                    <Home className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Campaigns" isActive={isActive('/campaigns')} asChild>
                  <Link href="/campaigns">
                    <Target className="w-4 h-4" />
                    <span>Campaigns</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Analytics" isActive={isActive('/analytics')} asChild>
                  <Link href="/analytics">
                    <BarChart3 className="w-4 h-4" />
                    <span>Analytics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="AI Demo" isActive={isActive('/ai-demo')} asChild>
                  <Link href="/ai-demo">
                    <Brain className="w-4 h-4" />
                    <span>AI Demo</span>
                    <Badge variant="secondary" className="ml-auto">
                      New
                    </Badge>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Performance" isActive={isActive('/performance')} asChild>
                  <Link href="/performance">
                    <Activity className="w-4 h-4" />
                    <span>Performance</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Advanced Analytics */}
        <SidebarGroup>
          <SidebarGroupLabel>Advanced Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Funnel Analysis" asChild>
                  <Link href="/funnel-analysis">
                    <TrendingUp className="w-4 h-4" />
                    <span>Funnel Analysis</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Attribution" asChild>
                  <Link href="/attribution">
                    <Eye className="w-4 h-4" />
                    <span>Attribution</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Audience Insights" asChild>
                  <Link href="/audience">
                    <Users className="w-4 h-4" />
                    <span>Audience</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Revenue Tracking" asChild>
                  <Link href="/revenue">
                    <DollarSign className="w-4 h-4" />
                    <span>Revenue</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AI & Automation */}
        <SidebarGroup>
          <SidebarGroupLabel>AI & Automation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="AI Predictions" asChild>
                  <Link href="/ai-predictions">
                    <Sparkles className="w-4 h-4" />
                    <span>Predictions</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Auto-Optimization" asChild>
                  <Link href="/auto-optimization">
                    <Zap className="w-4 h-4" />
                    <span>Auto-Optimize</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Reports" asChild>
                  <Link href="/reports">
                    <FileText className="w-4 h-4" />
                    <span>Reports</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Actions */}
        <SidebarGroup>
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleRefreshData} tooltip="Refresh Data">
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleExportData} tooltip="Export Data">
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleQuickOptimize} tooltip="Quick Optimize">
                  <Zap className="w-4 h-4" />
                  <span>Optimize</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with Settings */}
      <SidebarFooter className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-200 dark:border-gray-700">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" isActive={isActive('/settings')} asChild>
              <Link href="/settings">
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}