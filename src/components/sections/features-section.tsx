'use client'

import React from 'react'
import { motion } from 'framer-motion'
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
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { EnhancedBadge } from '../ui/enhanced-badge'
import { ModernCard } from '../ui/modern-card'

const features = [
  {
    icon: BarChart3,
    title: 'Multi-Touch Attribution',
    description: 'Track customer journey across all touchpoints with advanced attribution modeling',
    benefits: ['Cross-channel tracking', 'Custom attribution models', 'Real-time insights'],
    gradient: 'from-purple-500 to-pink-500',
    delay: 0.1
  },
  {
    icon: TrendingUp,
    title: 'Cross-Channel Reporting',
    description: 'Unified analytics dashboard across all marketing channels and platforms',
    benefits: ['Unified dashboard', 'Custom reports', 'Automated insights'],
    gradient: 'from-blue-500 to-cyan-500',
    delay: 0.2
  },
  {
    icon: Target,
    title: 'Real-time Insights',
    description: 'Live data and instant performance feedback for immediate optimization',
    benefits: ['Live data feeds', 'Instant alerts', 'Performance tracking'],
    gradient: 'from-green-500 to-emerald-500',
    delay: 0.3
  },
  {
    icon: Globe,
    title: 'Unified Customer Journeys',
    description: 'Complete view of customer interactions across all touchpoints',
    benefits: ['Journey mapping', 'Behavioral analysis', 'Personalization'],
    gradient: 'from-orange-500 to-red-500',
    delay: 0.4
  },
  {
    icon: Zap,
    title: 'Predictive Analytics',
    description: 'AI-powered forecasting and optimization recommendations',
    benefits: ['AI predictions', 'Smart recommendations', 'Automated optimization'],
    gradient: 'from-yellow-500 to-orange-500',
    delay: 0.5
  },
  {
    icon: Shield,
    title: 'Optimized Ad Spend',
    description: 'Maximize ROI with intelligent budget allocation and performance tracking',
    benefits: ['Budget optimization', 'ROI tracking', 'Smart bidding'],
    gradient: 'from-indigo-500 to-purple-500',
    delay: 0.6
  }
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const cardVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: 'easeOut'
    }
  }
}

export const FeaturesSection: React.FC = () => {
  return (
    <section className="py-24 bg-gradient-to-br from-gray-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900/20 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <EnhancedBadge variant="gradient" size="lg" className="mb-6">
            ✨ FEATURES
          </EnhancedBadge>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-purple-800 to-blue-800 dark:from-white dark:via-purple-200 dark:to-blue-200 bg-clip-text text-transparent">
            Advanced Attribution
            <br />
            <span className="text-purple-600 dark:text-purple-400">
              That Drives Results
            </span>
          </h2>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Comprehensive analytics and attribution tools designed to maximize your marketing ROI. 
            Track every touchpoint, optimize every campaign, and scale your business with confidence.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              custom={feature.delay}
              className="group"
            >
              <ModernCard
                variant="glass"
                className="h-full p-8 hover:scale-105 transition-all duration-300 border border-white/20 dark:border-gray-700/20"
              >
                {/* Icon */}
                <div className={cn(
                  'w-16 h-16 rounded-2xl bg-gradient-to-r mb-6 flex items-center justify-center',
                  feature.gradient
                )}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>

                  {/* Benefits */}
                  <div className="space-y-2">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <motion.div
                        key={benefitIndex}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: feature.delay + benefitIndex * 0.1 }}
                        className="flex items-center space-x-2"
                      >
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {benefit}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Learn More */}
                  <motion.button
                    whileHover={{ x: 5 }}
                    className="flex items-center text-purple-600 dark:text-purple-400 font-medium group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors duration-200"
                  >
                    Learn More
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </motion.button>
                </div>
              </ModernCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 md:p-12 text-white">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Transform Your Marketing?
            </h3>
            <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses already using Ads Pro Enterprise to scale their digital marketing efforts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200"
              >
                Start Free Trial
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 border-2 border-white/30 text-white rounded-lg font-semibold hover:bg-white/10 transition-colors duration-200"
              >
                Schedule Demo
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
} 