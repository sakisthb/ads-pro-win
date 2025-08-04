'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import { 
  Mic, 
  MicOff, 
  Brain, 
  Zap, 
  Target, 
  TrendingUp,
  BarChart3,
  Eye,
  MousePointer,
  Smartphone,
  Monitor,
  Globe,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Settings,
  Lightbulb,
  Sparkles,
  Rocket,
  Star,
  Award,
  Users,
  DollarSign,
  Shield,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info
} from 'lucide-react'
import { ModernCard } from '@/components/ui/modern-card'
import { EnhancedBadge } from '@/components/ui/enhanced-badge'
import { GradientButton } from '@/components/ui/gradient-button'

interface AICommand {
  id: string
  command: string
  response: string
  icon: React.ComponentType<any>
  color: string
  category: 'analytics' | 'optimization' | 'insights' | 'automation'
}

interface AIInsight {
  id: string
  title: string
  description: string
  impact: string
  confidence: number
  icon: React.ComponentType<any>
  color: string
  priority: 'high' | 'medium' | 'low'
}

export const AIInteractiveDemo: React.FC = () => {
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentCommand, setCurrentCommand] = useState<string>('')
  const [showResponse, setShowResponse] = useState(false)
  const [aiResponse, setAiResponse] = useState<string>('')
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [activeTab, setActiveTab] = useState<'demo' | 'insights' | 'analytics'>('demo')

  const aiCommands: AICommand[] = [
    {
      id: '1',
      command: 'Show me campaign performance',
      response: 'Analyzing your campaign data... Here are the key metrics: Conversion rate increased by 15%, ROI improved by 23%, and click-through rate is up 8%.',
      icon: BarChart3,
      color: 'from-blue-500 to-cyan-500',
      category: 'analytics'
    },
    {
      id: '2',
      command: 'Optimize my ad spend',
      response: 'AI optimization in progress... I\'ve identified 3 underperforming campaigns and reallocated $2,400 to high-performing segments. Expected ROI improvement: 18%.',
      icon: Target,
      color: 'from-green-500 to-emerald-500',
      category: 'optimization'
    },
    {
      id: '3',
      command: 'Find new opportunities',
      response: 'Scanning market data... I\'ve found 5 new audience segments with high conversion potential. Also detected seasonal trends that could increase your revenue by 12%.',
      icon: Lightbulb,
      color: 'from-yellow-500 to-orange-500',
      category: 'insights'
    },
    {
      id: '4',
      command: 'Automate my workflow',
      response: 'Setting up automation... I\'ve created 3 new automated rules: budget alerts, performance thresholds, and competitor monitoring. This will save you 8 hours per week.',
      icon: Zap,
      color: 'from-purple-500 to-pink-500',
      category: 'automation'
    }
  ]

  const generateInsights = () => {
    const newInsights: AIInsight[] = [
      {
        id: '1',
        title: 'Audience Segment Discovery',
        description: 'New high-value audience segment identified with 3.2x higher conversion rate',
        impact: '+$12,400 monthly revenue',
        confidence: 94,
        icon: Users,
        color: 'from-blue-500 to-cyan-500',
        priority: 'high'
      },
      {
        id: '2',
        title: 'Ad Creative Optimization',
        description: 'Video ads perform 47% better than static images in your target demographic',
        impact: '+18% click-through rate',
        confidence: 87,
        icon: Eye,
        color: 'from-green-500 to-emerald-500',
        priority: 'medium'
      },
      {
        id: '3',
        title: 'Budget Reallocation',
        description: 'Shifting 15% of budget from underperforming to high-ROI campaigns',
        impact: '+23% overall ROI',
        confidence: 91,
        icon: DollarSign,
        color: 'from-purple-500 to-pink-500',
        priority: 'high'
      },
      {
        id: '4',
        title: 'Competitor Analysis',
        description: 'Competitor X launched new campaign targeting your audience',
        impact: 'Monitor and adjust strategy',
        confidence: 76,
        icon: Shield,
        color: 'from-orange-500 to-red-500',
        priority: 'medium'
      }
    ]
    setInsights(newInsights)
  }

  useEffect(() => {
    generateInsights()
  }, [])

  const handleVoiceCommand = (command: AICommand) => {
    setIsListening(true)
    setCurrentCommand(command.command)
    
    setTimeout(() => {
      setIsListening(false)
      setAiResponse(command.response)
      setShowResponse(true)
      
      setTimeout(() => {
        setShowResponse(false)
        setCurrentCommand('')
        setAiResponse('')
      }, 5000)
    }, 2000)
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-400'
    if (confidence >= 80) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'from-red-500 to-pink-500'
      case 'medium': return 'from-yellow-500 to-orange-500'
      case 'low': return 'from-green-500 to-emerald-500'
      default: return 'from-gray-500 to-gray-600'
    }
  }

  return (
    <section className="relative w-full py-20 bg-gradient-to-br from-black via-purple-900 to-blue-900 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30" />
        <motion.div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
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
            <Brain className="w-6 h-6 text-purple-400" />
            <EnhancedBadge variant="glow" size="lg" animate>
              AI-Powered Demo
            </EnhancedBadge>
            <Brain className="w-6 h-6 text-purple-400" />
          </motion.div>

          <h2 className="text-4xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
            Experience AI Magic
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Interact with our AI assistant using voice commands and see real-time insights
          </p>
        </motion.div>

        {/* Interactive Demo */}
        <div className="max-w-6xl mx-auto">
          <ModernCard variant="glass" className="p-8 md:p-12">
            {/* Tab Navigation */}
            <div className="flex justify-center mb-8">
              <div className="flex bg-white/10 backdrop-blur-sm rounded-lg p-1">
                {[
                  { id: 'demo', label: 'Voice Commands', icon: Mic },
                  { id: 'insights', label: 'AI Insights', icon: Brain },
                  { id: 'analytics', label: 'Live Analytics', icon: BarChart3 }
                ].map((tab) => (
                  <motion.button
                    key={tab.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'demo' && (
                <motion.div
                  key="demo"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  {/* Voice Command Interface */}
                  <div className="mb-8">
                    <motion.div
                      className={`w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center ${
                        isListening 
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 animate-pulse' 
                          : 'bg-gradient-to-r from-purple-500 to-blue-500'
                      }`}
                      animate={isListening ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {isListening ? (
                        <Mic className="w-12 h-12 text-white" />
                      ) : (
                        <MicOff className="w-12 h-12 text-white" />
                      )}
                    </motion.div>
                    
                    <h3 className="text-2xl font-bold text-white mb-4">
                      {isListening ? 'Listening...' : 'Ready for Commands'}
                    </h3>
                    
                    {currentCommand && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-lg text-gray-300 mb-4"
                      >
                        "{currentCommand}"
                      </motion.div>
                    )}
                  </div>

                  {/* Command Buttons */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {aiCommands.map((command, index) => (
                      <motion.button
                        key={command.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        onClick={() => handleVoiceCommand(command)}
                        className="flex items-center gap-4 p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-white/10 transition-all text-left"
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${command.color} flex items-center justify-center`}>
                          <command.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="font-medium text-white">{command.command}</div>
                          <div className="text-sm text-gray-400 capitalize">{command.category}</div>
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  {/* AI Response */}
                  <AnimatePresence>
                    {showResponse && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-white/20 rounded-lg p-6"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <Brain className="w-6 h-6 text-purple-400" />
                          <span className="font-medium text-white">AI Response</span>
                        </div>
                        <p className="text-gray-300 leading-relaxed">{aiResponse}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {activeTab === 'insights' && (
                <motion.div
                  key="insights"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {insights.map((insight, index) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        whileHover={{ y: -5 }}
                      >
                        <ModernCard variant="glass" className="p-6">
                          <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${insight.color} flex items-center justify-center flex-shrink-0`}>
                              <insight.icon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-bold text-white">{insight.title}</h4>
                                <EnhancedBadge 
                                  variant="gradient" 
                                  size="sm" 
                                  className={`bg-gradient-to-r ${getPriorityColor(insight.priority)}`}
                                >
                                  {insight.priority}
                                </EnhancedBadge>
                              </div>
                              <p className="text-gray-300 text-sm mb-3">{insight.description}</p>
                              <div className="flex items-center justify-between">
                                <div className="text-green-400 font-medium text-sm">{insight.impact}</div>
                                <div className={`text-sm ${getConfidenceColor(insight.confidence)}`}>
                                  {insight.confidence}% confidence
                                </div>
                              </div>
                            </div>
                          </div>
                        </ModernCard>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'analytics' && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {[
                      { label: 'Real-time Users', value: '2,847', icon: Users, color: 'from-green-500 to-emerald-500' },
                      { label: 'Active Campaigns', value: '23', icon: Target, color: 'from-blue-500 to-cyan-500' },
                      { label: 'Revenue Today', value: '$12,847', icon: DollarSign, color: 'from-purple-500 to-pink-500' }
                    ].map((metric, index) => (
                      <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: index * 0.1 }}
                        className="text-center"
                      >
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${metric.color} flex items-center justify-center`}>
                          <metric.icon className="w-8 h-8 text-white" />
                        </div>
                        <div className="text-3xl font-bold text-white mb-2">{metric.value}</div>
                        <div className="text-gray-300">{metric.label}</div>
                      </motion.div>
                    ))}
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 backdrop-blur-sm border border-white/20 rounded-lg p-6"
                  >
                    <h3 className="text-xl font-bold text-white mb-4">AI-Powered Recommendations</h3>
                    <div className="space-y-3 text-left">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-gray-300">Increase budget for Campaign A by 15%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-gray-300">Pause underperforming ad creatives</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-gray-300">Target new audience segment</span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </ModernCard>
        </div>
      </div>
    </section>
  )
} 