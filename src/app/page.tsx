'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion'
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Globe, 
  Zap, 
  Shield, 
  Database, 
  Cloud,
  ArrowRight,
  CheckCircle,
  Star,
  Users,
  DollarSign,
  Award,
  Rocket,
  Sparkles,
  Eye,
  Brain,
  Cpu,
  Network,
  Lock,
  RefreshCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Trophy
} from 'lucide-react'
import { HeroSection } from '@/components/sections/hero-section'
import { FeaturesSection } from '@/components/sections/features-section'
import { PricingSection } from '@/components/sections/pricing-section'
import { TestimonialsSection } from '@/components/sections/testimonials-section'
import { InteractiveGlobe } from '@/components/sections/interactive-globe'
import { RealTimeDashboard } from '@/components/sections/real-time-dashboard'
import { AIInteractiveDemo } from '@/components/sections/ai-interactive-demo'
import { EnhancedNavigation } from '@/components/ui/enhanced-navigation'
import { GradientButton } from '@/components/ui/gradient-button'
import { EnhancedBadge } from '@/components/ui/enhanced-badge'
import { ModernCard } from '@/components/ui/modern-card'

const navigationItems = [
  {
    label: 'Features',
    href: '#features',
    children: [
      { label: 'Attribution', href: '#attribution' },
      { label: 'Analytics', href: '#analytics' },
      { label: 'Reporting', href: '#reporting' }
    ]
  },
  {
    label: 'Pricing',
    href: '#pricing'
  },
  {
    label: 'About',
    href: '#about',
    children: [
      { label: 'Company', href: '#company' },
      { label: 'Team', href: '#team' },
      { label: 'Careers', href: '#careers' }
    ]
  },
  {
    label: 'Resources',
    href: '#resources',
    children: [
      { label: 'Documentation', href: '#docs' },
      { label: 'API Reference', href: '#api' },
      { label: 'Support', href: '#support' }
    ]
  }
]

// Floating particles component
const FloatingParticles = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full opacity-20"
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
        />
      ))}
    </div>
  )
}

// Interactive stats component
const InteractiveStats = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [currentStats, setCurrentStats] = useState({
    users: 0,
    revenue: 0,
    uptime: 0,
    integrations: 0
  })

  const targetStats = {
    users: 15000,
    revenue: 3.2,
    uptime: 99.99,
    integrations: 75
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    const element = document.getElementById('stats-section')
    if (element) observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (isVisible) {
      const duration = 2000
      const steps = 60
      const stepDuration = duration / steps

      const interval = setInterval(() => {
        setCurrentStats(prev => ({
          users: Math.min(prev.users + Math.ceil(targetStats.users / steps), targetStats.users),
          revenue: Math.min(prev.revenue + targetStats.revenue / steps, targetStats.revenue),
          uptime: Math.min(prev.uptime + targetStats.uptime / steps, targetStats.uptime),
          integrations: Math.min(prev.integrations + Math.ceil(targetStats.integrations / steps), targetStats.integrations)
        }))
      }, stepDuration)

      return () => clearInterval(interval)
    }
  }, [isVisible])

  return (
    <section id="stats-section" className="relative w-full py-20 bg-gradient-to-r from-gray-900 via-purple-900 to-blue-900 dark:from-black dark:via-purple-900 dark:to-blue-900 overflow-hidden">
      <FloatingParticles />
      
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-500/5 to-blue-500/5" />
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
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 mb-6"
          >
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <EnhancedBadge variant="gradient" size="lg" animate>
              Enterprise Ready
            </EnhancedBadge>
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </motion.div>
          
          <h2 className="text-4xl md:text-7xl font-bold text-white mb-6 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
            Trusted by Industry Leaders
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Join thousands of companies that trust our platform for their marketing analytics
          </p>
        </motion.div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {[
            { 
              number: currentStats.users.toLocaleString(), 
              label: 'Active Users', 
              icon: Users,
              color: 'from-purple-500 to-pink-500',
              delay: 0.1
            },
            { 
              number: `$${currentStats.revenue.toFixed(1)}B+`, 
              label: 'Revenue Tracked', 
              icon: DollarSign,
              color: 'from-green-500 to-emerald-500',
              delay: 0.2
            },
            { 
              number: `${currentStats.uptime.toFixed(2)}%`, 
              label: 'Uptime', 
              icon: Shield,
              color: 'from-blue-500 to-cyan-500',
              delay: 0.3
            },
            { 
              number: `${currentStats.integrations}+`, 
              label: 'Integrations', 
              icon: Network,
              color: 'from-orange-500 to-red-500',
              delay: 0.4
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: stat.delay }}
              className="text-center group"
            >
              <motion.div
                className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-r ${stat.color} flex items-center justify-center`}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <stat.icon className="w-10 h-10 text-white" />
              </motion.div>
              <div className="text-4xl md:text-5xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                {stat.number}
              </div>
              <div className="text-gray-300 text-lg group-hover:text-gray-200 transition-colors">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-center mt-12"
        >
          <GradientButton size="xl" onClick={() => {}}>
            <Rocket className="w-5 h-5 mr-2" />
            Join Them Today
          </GradientButton>
        </motion.div>
      </div>
    </section>
  )
}

// AI Demo Section
const AIDemoSection = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentDemo, setCurrentDemo] = useState(0)

  const demos = [
    { title: 'AI-Powered Attribution', icon: Brain, color: 'from-purple-500 to-pink-500' },
    { title: 'Real-time Analytics', icon: Cpu, color: 'from-blue-500 to-cyan-500' },
    { title: 'Predictive Insights', icon: Eye, color: 'from-green-500 to-emerald-500' },
    { title: 'Smart Optimization', icon: Target, color: 'from-orange-500 to-red-500' }
  ]

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentDemo(prev => (prev + 1) % demos.length)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [isPlaying, demos.length])

  return (
    <section className="relative w-full py-20 bg-gradient-to-br from-black via-purple-900 to-blue-900 overflow-hidden">
      <FloatingParticles />
      
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
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center text-white"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 mb-6"
          >
            <Brain className="w-6 h-6 text-purple-400" />
            <EnhancedBadge variant="glow" size="lg" animate>
              AI-Powered Platform
            </EnhancedBadge>
            <Brain className="w-6 h-6 text-purple-400" />
          </motion.div>

          <h2 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
            Experience the Future
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto">
            Watch our AI in action as it transforms your marketing data into actionable insights
          </p>

          {/* Interactive Demo */}
          <div className="max-w-4xl mx-auto">
            <ModernCard variant="glass" className="p-8 md:p-12 text-center">
              <motion.div
                key={currentDemo}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <div className={`w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-r ${demos[currentDemo].color} flex items-center justify-center`}>
                  <demos[currentDemo].icon className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-white mb-4">{demos[currentDemo].title}</h3>
                <p className="text-gray-300 text-lg">
                  Watch our AI analyze your marketing data in real-time and provide intelligent recommendations
                </p>
              </motion.div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg font-medium"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {isPlaying ? 'Pause' : 'Play'} Demo
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsMuted(!isMuted)}
                  className="flex items-center gap-2 px-4 py-3 border border-white/30 text-white rounded-lg font-medium hover:bg-white/10"
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentDemo(prev => (prev + 1) % demos.length)}
                  className="flex items-center gap-2 px-4 py-3 border border-white/30 text-white rounded-lg font-medium hover:bg-white/10"
                >
                  <RefreshCw className="w-5 h-5" />
                  Next
                </motion.button>
              </div>
            </ModernCard>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

// Awards Section
const AwardsSection = () => {
  const awards = [
    { title: 'Best Analytics Platform 2024', icon: Award, company: 'TechCrunch' },
    { title: 'AI Innovation Award', icon: Star, company: 'Forbes' },
    { title: 'Enterprise Solution of the Year', icon: Trophy, company: 'Gartner' },
    { title: 'Customer Choice Award', icon: Users, company: 'Capterra' }
  ]

  return (
    <section className="relative w-full py-20 bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-black overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Recognized Excellence
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Industry recognition for our innovative approach to marketing analytics
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {awards.map((award, index) => (
            <motion.div
              key={award.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className="text-center group"
            >
              <ModernCard variant="elevated" className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
                  <award.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {award.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{award.company}</p>
              </ModernCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 1000], [0, -200])
  const opacity = useTransform(scrollY, [0, 500], [1, 0])

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      {/* Navigation */}
      <EnhancedNavigation
        items={navigationItems}
        variant="glass"
        showSearch={true}
        showNotifications={true}
        showUserMenu={true}
      />

      {/* Hero Section */}
      <HeroSection />

      {/* AI Demo Section */}
      <AIDemoSection />

      {/* Interactive Globe */}
      <InteractiveGlobe />

      {/* Interactive Stats */}
      <InteractiveStats />

      {/* Real-Time Dashboard */}
      <RealTimeDashboard />

      {/* AI Interactive Demo */}
      <AIInteractiveDemo />

      {/* Features Section */}
      <div id="features">
        <FeaturesSection />
      </div>

      {/* Awards Section */}
      <AwardsSection />

      {/* Pricing Section */}
      <div id="pricing">
        <PricingSection />
      </div>

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-white py-16 w-full">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">Ads Pro Enterprise</h3>
              <p className="text-gray-400">
                Advanced attribution analytics and cross-channel reporting that drives real results.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>© 2024 Ads Pro Enterprise. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}