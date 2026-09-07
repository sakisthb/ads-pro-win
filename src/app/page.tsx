'use client'

import React, { useState, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, CheckCircle, Star, Zap, Shield, Globe,
  TrendingUp, BarChart3, Brain, Target, Sparkles,
  Rocket, Play, ChevronRight, Mail,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { AnimatedSection, StaggerContainer } from '@/components/ui/animated-section'

/* ──────────────────────────────────────────────
   Deterministic particle data (no Math.random)
   ────────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 35 }, (_, i) => ({
  x: (i * 37 + 13) % 100,
  startY: (i * 53 + 7) % 100,
  size: ((i * 17 + 3) % 4) + 1,
  duration: ((i * 13 + 5) % 12) + 8,
  delay: (i * 7 + 2) % 10,
  opacity: ((i * 11 + 9) % 5) / 10 + 0.1,
}))

const ORBS = [
  { cx: '15%', cy: '20%', r: 220, from: 'from-blue-500/30', to: 'to-purple-500/30', dur: 18 },
  { cx: '75%', cy: '35%', r: 280, from: 'from-pink-500/25', to: 'to-orange-500/25', dur: 22 },
  { cx: '50%', cy: '70%', r: 200, from: 'from-cyan-500/20', to: 'to-blue-500/20', dur: 16 },
  { cx: '85%', cy: '80%', r: 180, from: 'from-purple-500/20', to: 'to-pink-500/20', dur: 20 },
]

const STATS = [
  { label: 'Average ROI', target: 340, prefix: '+', suffix: '%' },
  { label: 'Brands Served', target: 500, prefix: '', suffix: '+' },
  { label: 'Platforms', target: 4, prefix: '', suffix: '' },
  { label: 'Uptime', target: 99.9, prefix: '', suffix: '%', decimals: 1 },
]

const DEMO_TABS = [
  {
    id: 'revenue',
    label: 'Revenue Overview',
    icon: BarChart3,
    bars: [65, 45, 80, 55, 90, 70, 95],
    metric: '€4.1M',
    metricLabel: 'Total Revenue',
    trend: '+34%',
  },
  {
    id: 'attribution',
    label: 'Attribution',
    icon: Target,
    bars: [40, 70, 55, 85, 60, 75, 50],
    metric: '6.3x',
    metricLabel: 'Blended ROAS',
    trend: '+1.2x',
  },
  {
    id: 'predictions',
    label: 'AI Predictions',
    icon: Brain,
    bars: [50, 60, 75, 80, 88, 92, 97],
    metric: '97%',
    metricLabel: 'Forecast Accuracy',
    trend: '+5%',
  },
]

const PLATFORMS = [
  { name: 'Meta Ads', color: '#1877F2' },
  { name: 'Google Ads', color: '#4285F4' },
  { name: 'TikTok', color: '#FF0050' },
  { name: 'WooCommerce', color: '#96588A' },
  { name: 'Shopify', color: '#7AB55C' },
  { name: 'LinkedIn', color: '#0A66C2' },
]

const TESTIMONIALS = [
  {
    quote: 'Ads Pro transformed how we allocate budget. ROI jumped 340% in six months.',
    name: 'Maria K.',
    role: 'CMO, TechVentures',
    stars: 5,
  },
  {
    quote: 'The AI predictions are scarily accurate. We stopped guessing and started scaling.',
    name: 'Jonas W.',
    role: 'Head of Growth, ScaleUp EU',
    stars: 5,
  },
  {
    quote: 'Finally, one dashboard for Meta, Google, TikTok and WooCommerce. Game changer.',
    name: 'Elena P.',
    role: 'Director, CommerceLab',
    stars: 5,
  },
]

const PRICING = [
  {
    name: 'Pro',
    price: '€497',
    period: '/mo',
    features: ['5 Ad Accounts', 'Cross-Platform Attribution', 'Real-Time Dashboard', 'Email Support', '30-Day Data Retention'],
    popular: false,
  },
  {
    name: 'Enterprise',
    price: '€1,497',
    period: '/mo',
    features: ['Unlimited Ad Accounts', 'AI Predictions', 'Custom Integrations', 'Priority Support 24/7', 'Unlimited Data Retention', 'Dedicated CSM'],
    popular: true,
  },
  {
    name: 'Scale',
    price: 'Custom',
    period: '',
    features: ['White-Label Solution', 'On-Premise Deployment', 'SLA Guarantee', 'Custom AI Models', 'Team Training', 'API Access'],
    popular: false,
  },
]

/* ──────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────── */

function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"
          style={{
            left: `${p.x}%`,
            top: `${p.startY}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{ y: [0, -800], opacity: [0, p.opacity, p.opacity, 0], scale: [0.5, 1, 1, 0.5] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  )
}

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full bg-gradient-to-br ${orb.from} ${orb.to} blur-3xl`}
          style={{ left: orb.cx, top: orb.cy, width: orb.r, height: orb.r }}
          animate={{ x: [0, 40, -30, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.95, 1] }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter()
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })

  // Parallax layers
  const ySlow = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const yMid = useTransform(scrollYProgress, [0, 1], ['0%', '-15%'])
  const yFast = useTransform(scrollYProgress, [0, 1], ['0%', '40%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  const [activeTab, setActiveTab] = useState('revenue')
  const currentDemo = DEMO_TABS.find((t) => t.id === activeTab) ?? DEMO_TABS[0]

  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* ═══════════════════════════════════════
          HERO
          ═══════════════════════════════════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Parallax layer 1 — slow (orbs) */}
        <motion.div style={{ y: ySlow }} className="absolute inset-0">
          <FloatingOrbs />
        </motion.div>

        {/* Parallax layer 2 — mid (grid + particles) */}
        <motion.div style={{ y: yMid }} className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px]" />
          <ParticleField />
        </motion.div>

        {/* Parallax layer 3 — fast (radial glow) */}
        <motion.div style={{ y: yFast }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-radial from-purple-500/15 via-transparent to-transparent blur-2xl" />
        </motion.div>

        {/* Content */}
        <motion.div style={{ opacity: heroOpacity }} className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 text-center pt-28 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="inline-flex items-center gap-2 mb-8 px-5 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">AI-Powered Marketing Intelligence</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.1] mb-8 tracking-tight"
          >
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Stop Guessing.
            </span>
            <br />
            <span className="text-white">Start Scaling.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Unified attribution, real-time analytics, and AI predictions across every ad platform — so you know exactly where to invest your next euro.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <button
              onClick={() => router.push('/auth/signup')}
              className="group relative px-8 py-4 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 font-semibold text-lg shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow duration-500 hover:scale-105 active:scale-[0.98]">
              <span className="flex items-center gap-2">
                Get Started Free <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button className="group px-8 py-4 rounded-xl border border-gray-700 hover:border-purple-500/50 font-semibold text-lg text-gray-300 hover:text-white hover:bg-purple-500/10 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-500">
              <span className="flex items-center gap-2">
                <Play className="w-5 h-5" /> Watch Demo
              </span>
            </button>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {STATS.map((s) => (
              <div key={s.label} className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition-colors duration-300">
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  <AnimatedCounter target={s.target} prefix={s.prefix} suffix={s.suffix} decimals={s.decimals ?? 0} />
                </div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600"
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <div className="w-5 h-8 rounded-full border-2 border-gray-700 flex items-start justify-center p-1">
            <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-1 h-2 rounded-full bg-gray-500" />
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════
          INTERACTIVE DEMO
          ═══════════════════════════════════════ */}
      <section className="relative py-24 px-4 sm:px-6">
        <AnimatedSection className="max-w-5xl mx-auto text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">See It In Action</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Explore live scenarios from real dashboards — revenue, attribution, and AI-powered predictions.</p>
        </AnimatedSection>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {DEMO_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="bg-white/[0.03] backdrop-blur-xl rounded-2xl border border-white/10 p-6 sm:p-10 min-h-[340px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentDemo.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.35 }}
                className="grid sm:grid-cols-2 gap-8 items-center"
              >
                {/* Chart visualisation */}
                <div className="flex items-end gap-2 h-48">
                  {currentDemo.bars.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.6, delay: i * 0.07, ease: 'easeOut' }}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-blue-500/80 via-purple-500/80 to-pink-500/80 relative group"
                    >
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {h}%
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Metric card */}
                <div className="text-center sm:text-left">
                  <div className="text-5xl font-black text-white mb-2">{currentDemo.metric}</div>
                  <div className="text-gray-400 mb-4">{currentDemo.metricLabel}</div>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/15 text-green-400 text-sm font-semibold">
                    <TrendingUp className="w-4 h-4" /> {currentDemo.trend}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          PLATFORM INTEGRATIONS
          ═══════════════════════════════════════ */}
      <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
        {/* Connection lines SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <line x1="10%" y1="30%" x2="90%" y2="70%" stroke="white" strokeWidth="1" />
          <line x1="20%" y1="80%" x2="80%" y2="20%" stroke="white" strokeWidth="1" />
          <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="white" strokeWidth="1" />
          <line x1="5%" y1="50%" x2="95%" y2="50%" stroke="white" strokeWidth="1" />
        </svg>

        <AnimatedSection className="max-w-5xl mx-auto text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Every Platform. One View.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Connect your entire marketing stack in minutes — no engineering required.</p>
        </AnimatedSection>

        <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 max-w-4xl mx-auto">
          {PLATFORMS.map((p) => (
            <motion.div
              key={p.name}
              variants={{ initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } }}
              whileHover={{ y: -8, scale: 1.05 }}
              className="flex flex-col items-center gap-3 bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:border-purple-500/40 transition-colors duration-300"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3 + (p.name.length % 3), repeat: Infinity, ease: 'easeInOut' }}
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: p.color }}
              >
                {p.name[0]}
              </motion.div>
              <span className="text-sm text-gray-400 font-medium">{p.name}</span>
            </motion.div>
          ))}
        </StaggerContainer>
      </section>

      {/* ═══════════════════════════════════════
          BEFORE / AFTER
          ═══════════════════════════════════════ */}
      <section className="relative py-24 px-4 sm:px-6">
        <AnimatedSection className="max-w-5xl mx-auto text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-400 to-pink-400 bg-clip-text text-transparent">Before vs After</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">See how Ads Pro transforms scattered data into unified intelligence.</p>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Before */}
          <AnimatedSection variant="fadeInLeft" className="bg-red-500/[0.04] border border-red-500/20 rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <h3 className="text-xl font-bold text-red-400">Before</h3>
            </div>
            <ul className="space-y-4 text-gray-400">
              {['Spreadsheets across 6+ tools', 'Manual CSV exports every week', 'No cross-platform attribution', 'Budget decisions based on gut feeling', 'Hours wasted on reporting'].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 text-red-400 text-xs">✕</span>
                  {item}
                </li>
              ))}
            </ul>
          </AnimatedSection>

          {/* After */}
          <AnimatedSection variant="fadeInRight" className="bg-green-500/[0.04] border border-green-500/20 rounded-2xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <h3 className="text-xl font-bold text-green-400">After</h3>
            </div>
            <ul className="space-y-4 text-gray-300">
              {['One dashboard for every platform', 'Real-time data sync, zero manual work', 'AI-powered multi-touch attribution', 'Data-driven budget optimization', 'Automated reports in one click'].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 w-5 h-5 text-green-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </AnimatedSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          PRICING
          ═══════════════════════════════════════ */}
      <section id="pricing" className="relative py-24 px-4 sm:px-6">
        <AnimatedSection className="max-w-5xl mx-auto text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Simple, Transparent Pricing</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Choose the plan that fits your scale. Upgrade or downgrade anytime.</p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PRICING.map((plan, idx) => (
            <AnimatedSection key={plan.name} delay={idx * 0.12}>
              <motion.div
                whileHover={{ y: -8 }}
                className={`relative h-full rounded-2xl p-8 border backdrop-blur-xl transition-all duration-500 ${
                  plan.popular
                    ? 'bg-gradient-to-b from-purple-500/15 to-blue-500/10 border-purple-500/40 shadow-xl shadow-purple-500/10'
                    : 'bg-white/[0.03] border-white/10 hover:border-purple-500/30'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-xs font-bold uppercase tracking-wide">
                    Most Popular
                  </span>
                )}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-gray-500 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-3 rounded-xl font-semibold transition-all duration-300 ${
                    plan.popular
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02]'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-500/40'
                  }`}
                >
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                  {plan.price !== 'Custom' && <ChevronRight className="w-4 h-4 inline ml-1" />}
                </button>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════ */}
      <section className="relative py-24 px-4 sm:px-6">
        <AnimatedSection className="max-w-5xl mx-auto text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent">Trusted by Growth Leaders</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Hear from teams that transformed their marketing with Ads Pro.</p>
        </AnimatedSection>

        <StaggerContainer className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TESTIMONIALS.map((t) => (
            <motion.div
              key={t.name}
              variants={{ initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } }}
              className="bg-white/[0.03] border border-white/10 rounded-2xl p-8 hover:border-purple-500/30 transition-colors duration-300"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }, (_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-300 mb-6 leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-bold">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </StaggerContainer>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER + NEWSLETTER
          ═══════════════════════════════════════ */}
      <footer className="relative border-t border-white/5 py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand + newsletter */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold">Ads Pro</span>
              </div>
              <p className="text-gray-500 text-sm mb-6 max-w-sm">
                AI-powered marketing analytics that shows you exactly where to invest your next euro.
              </p>
              <form onSubmit={(e) => e.preventDefault()} className="flex gap-2 max-w-sm">
                <input
                  type="email"
                  placeholder="you@company.com"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-shadow"
                >
                  <Mail className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold mb-4 text-gray-300">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                {['Features', 'Pricing', 'Integrations', 'API Docs'].map((l) => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4 text-gray-300">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                {['About', 'Blog', 'Careers', 'Contact'].map((l) => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <p>&copy; {new Date().getFullYear()} Ads Pro. All rights reserved.</p>
            <div className="flex gap-4">
              {['Privacy', 'Terms', 'Cookies'].map((l) => (
                <a key={l} href="#" className="hover:text-gray-400 transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
