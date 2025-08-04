'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { 
  BarChart3, 
  TrendingUp, 
  Activity, 
  Zap, 
  Target, 
  DollarSign,
  Users,
  Eye,
  MousePointer,
  Smartphone,
  Monitor,
  Globe,
  RefreshCw,
  Play,
  Pause
} from 'lucide-react'
import { ModernCard } from '@/components/ui/modern-card'
import { EnhancedBadge } from '@/components/ui/enhanced-badge'

interface DataPoint {
  timestamp: number
  value: number
  label: string
}

interface LiveMetric {
  id: string
  label: string
  value: number
  change: number
  icon: React.ComponentType<any>
  color: string
  trend: 'up' | 'down' | 'stable'
}

export const RealTimeDashboard: React.FC = () => {
  const [isLive, setIsLive] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [metrics, setMetrics] = useState<LiveMetric[]>([
    {
      id: 'conversions',
      label: 'Conversions',
      value: 1247,
      change: 12.5,
      icon: Target,
      color: 'from-green-500 to-emerald-500',
      trend: 'up'
    },
    {
      id: 'revenue',
      label: 'Revenue',
      value: 45678,
      change: 8.3,
      icon: DollarSign,
      color: 'from-blue-500 to-cyan-500',
      trend: 'up'
    },
    {
      id: 'clicks',
      label: 'Clicks',
      value: 89234,
      change: -2.1,
      icon: MousePointer,
      color: 'from-purple-500 to-pink-500',
      trend: 'down'
    },
    {
      id: 'impressions',
      label: 'Impressions',
      value: 234567,
      change: 15.7,
      icon: Eye,
      color: 'from-orange-500 to-red-500',
      trend: 'up'
    }
  ])

  const [chartData, setChartData] = useState<DataPoint[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
      
      if (isLive) {
        // Simulate real-time data updates
        setMetrics(prev => prev.map(metric => ({
          ...metric,
          value: metric.value + Math.floor(Math.random() * 10 - 5),
          change: metric.change + (Math.random() * 2 - 1)
        })))

        // Update chart data
        const newDataPoint: DataPoint = {
          timestamp: Date.now(),
          value: Math.floor(Math.random() * 1000) + 500,
          label: 'Live Data'
        }
        
        setChartData(prev => {
          const newData = [...prev, newDataPoint]
          return newData.slice(-20) // Keep last 20 points
        })
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [isLive])

  const generateChartBars = () => {
    return chartData.map((point, index) => (
      <motion.div
        key={index}
        className="flex-1 bg-gradient-to-t from-purple-500 to-blue-500 rounded-t"
        initial={{ height: 0 }}
        animate={{ height: `${(point.value / 1000) * 100}%` }}
        transition={{ duration: 0.5 }}
      />
    ))
  }

  return (
    <section className="relative w-full py-20 bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 dark:from-black dark:via-purple-900 dark:to-blue-900 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.2, 0.4],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
        />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center text-white mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 mb-6"
          >
            <Activity className="w-6 h-6 text-green-400" />
            <EnhancedBadge variant="glow" size="lg" animate>
              Live Dashboard
            </EnhancedBadge>
            <Activity className="w-6 h-6 text-green-400" />
          </motion.div>

          <h2 className="text-4xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
            Real-Time Analytics
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Monitor your campaign performance with live data updates and instant insights
          </p>

          {/* Live Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center justify-center gap-4 mt-8"
          >
            <div className="flex items-center gap-2">
              <motion.div
                className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-400' : 'bg-gray-400'}`}
                animate={isLive ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-sm text-gray-300">
                {isLive ? 'LIVE' : 'PAUSED'} • {currentTime.toLocaleTimeString()}
              </span>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsLive(!isLive)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              {isLive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isLive ? 'Pause' : 'Resume'} Live Data
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {metrics.map((metric, index) => (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -5 }}
            >
              <ModernCard variant="glass" className="p-6 text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${metric.color} flex items-center justify-center`}>
                  <metric.icon className="w-8 h-8 text-white" />
                </div>
                
                <div className="text-3xl font-bold text-white mb-2">
                  {metric.label === 'Revenue' ? `$${metric.value.toLocaleString()}` : metric.value.toLocaleString()}
                </div>
                
                <div className="text-lg text-gray-300 mb-2">{metric.label}</div>
                
                <div className={`flex items-center justify-center gap-1 text-sm ${
                  metric.trend === 'up' ? 'text-green-400' : 
                  metric.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                }`}>
                  <TrendingUp className={`w-4 h-4 ${metric.trend === 'down' ? 'rotate-180' : ''}`} />
                  <span>{Math.abs(metric.change).toFixed(1)}%</span>
                </div>
              </ModernCard>
            </motion.div>
          ))}
        </div>

        {/* Live Chart */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <ModernCard variant="glass" className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Live Performance Chart</h3>
              <motion.div
                animate={isLive ? { rotate: 360 } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <RefreshCw className="w-5 h-5 text-green-400" />
              </motion.div>
            </div>
            
            <div className="h-64 flex items-end gap-1">
              {chartData.length > 0 ? generateChartBars() : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                    <p>Waiting for live data...</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-4 text-sm text-gray-400 text-center">
              Real-time data updates every 2 seconds
            </div>
          </ModernCard>
        </motion.div>

        {/* Device Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-12"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Desktop', percentage: 45, icon: Monitor, color: 'from-blue-500 to-cyan-500' },
              { label: 'Mobile', percentage: 38, icon: Smartphone, color: 'from-purple-500 to-pink-500' },
              { label: 'Tablet', percentage: 17, icon: Globe, color: 'from-green-500 to-emerald-500' }
            ].map((device, index) => (
              <motion.div
                key={device.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                className="text-center"
              >
                <ModernCard variant="elevated" className="p-6">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${device.color} flex items-center justify-center`}>
                    <device.icon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {device.percentage}%
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">{device.label}</div>
                </ModernCard>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
} 