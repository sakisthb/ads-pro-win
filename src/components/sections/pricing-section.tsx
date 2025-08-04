'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Star, Zap, Crown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EnhancedBadge } from '../ui/enhanced-badge'
import { ModernCard } from '../ui/modern-card'
import { GradientButton } from '../ui/gradient-button'

const plans = [
  {
    name: 'Starter',
    price: 29,
    description: 'Perfect for small businesses getting started',
    features: [
      'Up to 5 campaigns',
      'Basic attribution',
      'Email support',
      'Standard reports',
      '1 user'
    ],
    gradient: 'from-gray-500 to-gray-600',
    icon: Star,
    popular: false,
    delay: 0.1
  },
  {
    name: 'Professional',
    price: 99,
    description: 'Ideal for growing businesses and marketing teams',
    features: [
      'Up to 50 campaigns',
      'Advanced attribution',
      'Priority support',
      'Custom reports',
      'Up to 10 users',
      'API access',
      'Advanced analytics'
    ],
    gradient: 'from-purple-500 to-blue-500',
    icon: Zap,
    popular: true,
    delay: 0.2
  },
  {
    name: 'Enterprise',
    price: 299,
    description: 'For large organizations with complex needs',
    features: [
      'Unlimited campaigns',
      'Multi-touch attribution',
      '24/7 support',
      'Custom integrations',
      'Unlimited users',
      'White-label options',
      'Dedicated account manager',
      'Advanced security'
    ],
    gradient: 'from-yellow-500 to-orange-500',
    icon: Crown,
    popular: false,
    delay: 0.3
  }
]

export const PricingSection: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [hoveredPlan, setHoveredPlan] = useState<number | null>(null)

  const getPrice = (basePrice: number) => {
    return billingCycle === 'yearly' ? Math.round(basePrice * 0.8) : basePrice
  }

  const getSavings = (basePrice: number) => {
    return billingCycle === 'yearly' ? Math.round(basePrice * 0.2) : 0
  }

  return (
    <section className="py-24 bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
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
            💎 PRICING
          </EnhancedBadge>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-white">
            Choose Your
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Growth Plan
            </span>
          </h2>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
            Flexible pricing plans designed to scale with your business. 
            Start free and upgrade as you grow.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4">
            <span className={cn(
              'text-sm font-medium transition-colors duration-200',
              billingCycle === 'monthly' ? 'text-white' : 'text-gray-400'
            )}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className={cn(
                'relative w-16 h-8 rounded-full transition-colors duration-200',
                billingCycle === 'yearly' ? 'bg-purple-600' : 'bg-gray-600'
              )}
            >
              <motion.div
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                animate={{ x: billingCycle === 'yearly' ? 32 : 4 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            </button>
            <span className={cn(
              'text-sm font-medium transition-colors duration-200',
              billingCycle === 'yearly' ? 'text-white' : 'text-gray-400'
            )}>
              Yearly
              <span className="ml-1 text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                Save 20%
              </span>
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: plan.delay }}
              viewport={{ once: true }}
              onHoverStart={() => setHoveredPlan(index)}
              onHoverEnd={() => setHoveredPlan(null)}
              className="relative"
            >
              {plan.popular && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: plan.delay + 0.2 }}
                  viewport={{ once: true }}
                  className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10"
                >
                  <EnhancedBadge variant="gradient" size="lg">
                    ⭐ Most Popular
                  </EnhancedBadge>
                </motion.div>
              )}

              <ModernCard
                variant="glass"
                className={cn(
                  'h-full p-8 relative overflow-hidden border border-white/20',
                  plan.popular && 'ring-2 ring-purple-500/50',
                  hoveredPlan === index && 'scale-105'
                )}
              >
                {/* Background Gradient */}
                <div className={cn(
                  'absolute inset-0 bg-gradient-to-br opacity-10 transition-opacity duration-300',
                  plan.gradient,
                  hoveredPlan === index && 'opacity-20'
                )} />

                {/* Content */}
                <div className="relative z-10">
                  {/* Header */}
                  <div className="text-center mb-8">
                    <div className={cn(
                      'w-16 h-16 rounded-2xl bg-gradient-to-r mx-auto mb-4 flex items-center justify-center',
                      plan.gradient
                    )}>
                      <plan.icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {plan.name}
                    </h3>
                    
                    <p className="text-gray-300 text-sm mb-6">
                      {plan.description}
                    </p>

                    {/* Price */}
                    <div className="mb-6">
                      <div className="flex items-baseline justify-center">
                        <span className="text-4xl font-bold text-white">
                          ${getPrice(plan.price)}
                        </span>
                        <span className="text-gray-400 ml-2">/month</span>
                      </div>
                      {billingCycle === 'yearly' && (
                        <div className="text-sm text-green-400 mt-1">
                          Save ${getSavings(plan.price)}/month
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-4 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <motion.div
                        key={featureIndex}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: plan.delay + featureIndex * 0.1 }}
                        viewport={{ once: true }}
                        className="flex items-center space-x-3"
                      >
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span className="text-gray-300 text-sm">
                          {feature}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <GradientButton
                    variant={plan.popular ? 'primary' : 'secondary'}
                    size="lg"
                    onClick={() => {}}
                    className="w-full group"
                  >
                    {plan.popular ? 'Get Started' : 'Choose Plan'}
                    <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                  </GradientButton>
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
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-white/20">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Need a Custom Solution?
            </h3>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Contact our sales team for enterprise pricing and custom integrations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white text-purple-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200"
              >
                Contact Sales
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