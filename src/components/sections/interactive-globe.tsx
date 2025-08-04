'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Globe, Users, DollarSign, TrendingUp, Zap } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'

interface DataPoint {
  id: number
  lat: number
  lng: number
  value: number
  label: string
  icon: React.ComponentType<any>
  color: string
}

const dataPoints: DataPoint[] = [
  { id: 1, lat: 40.7128, lng: -74.0060, value: 2500, label: 'New York', icon: Users, color: 'from-purple-500 to-pink-500' },
  { id: 2, lat: 51.5074, lng: -0.1278, value: 1800, label: 'London', icon: DollarSign, color: 'from-blue-500 to-cyan-500' },
  { id: 3, lat: 35.6762, lng: 139.6503, value: 3200, label: 'Tokyo', icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
  { id: 4, lat: -33.8688, lng: 151.2093, value: 1200, label: 'Sydney', icon: Zap, color: 'from-orange-500 to-red-500' },
  { id: 5, lat: 55.7558, lng: 37.6176, value: 900, label: 'Moscow', icon: Users, color: 'from-indigo-500 to-purple-500' },
  { id: 6, lat: -23.5505, lng: -46.6333, value: 1500, label: 'São Paulo', icon: DollarSign, color: 'from-yellow-500 to-orange-500' },
  { id: 7, lat: 19.0760, lng: 72.8777, value: 2800, label: 'Mumbai', icon: TrendingUp, color: 'from-teal-500 to-blue-500' },
  { id: 8, lat: 31.2304, lng: 121.4737, value: 3500, label: 'Shanghai', icon: Zap, color: 'from-pink-500 to-rose-500' }
]

export const InteractiveGlobe: React.FC = () => {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)
  const [isRotating, setIsRotating] = useState(true)
  const { scrollY } = useScroll()
  const rotateY = useTransform(scrollY, [0, 1000], [0, 360])
  const scale = useTransform(scrollY, [0, 500], [1, 1.2])

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRotating) {
        // Auto-rotate effect
      }
    }, 50)

    return () => clearInterval(interval)
  }, [isRotating])

  const getPosition = (lat: number, lng: number, radius: number = 200) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lng + 180) * (Math.PI / 180)
    
    const x = -(radius * Math.sin(phi) * Math.cos(theta))
    const y = radius * Math.cos(phi)
    const z = radius * Math.sin(phi) * Math.sin(theta)
    
    return { x, y, z }
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
            duration: 8,
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
          className="text-center text-white mb-16"
        >
          <h2 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
            Global Reach
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto">
            Our platform serves customers worldwide with real-time data and insights
          </p>
        </motion.div>

        {/* Interactive Globe */}
        <div className="relative h-96 md:h-[600px] flex items-center justify-center">
          {/* Globe Base */}
          <motion.div
            className="relative w-80 h-80 md:w-96 md:h-96"
            style={{ rotateY, scale }}
            animate={{ rotateY: isRotating ? 360 : 0 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          >
            {/* Globe Sphere */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/20 to-purple-400/20 backdrop-blur-sm border border-white/20">
              {/* Grid Lines */}
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-0 rounded-full border border-white/10" style={{ transform: 'rotateX(90deg)' }} />
              <div className="absolute inset-0 rounded-full border border-white/10" style={{ transform: 'rotateY(90deg)' }} />
            </div>

            {/* Data Points */}
            {dataPoints.map((point, index) => {
              const position = getPosition(point.lat, point.lng)
              const Icon = point.icon
              
              return (
                <motion.div
                  key={point.id}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate3d(${position.x}px, ${position.y}px, ${position.z}px)`,
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  whileHover={{ scale: 1.2 }}
                  onHoverStart={() => setHoveredPoint(point.id)}
                  onHoverEnd={() => setHoveredPoint(null)}
                >
                  {/* Data Point */}
                  <motion.div
                    className={`w-4 h-4 rounded-full bg-gradient-to-r ${point.color} shadow-lg shadow-purple-500/50`}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  
                  {/* Pulse Effect */}
                  <motion.div
                    className={`absolute inset-0 rounded-full bg-gradient-to-r ${point.color} opacity-30`}
                    animate={{
                      scale: [1, 2, 1],
                      opacity: [0.3, 0, 0.3],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                  />

                  {/* Tooltip */}
                  <AnimatePresence>
                    {hoveredPoint === point.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 whitespace-nowrap"
                      >
                        <div className="bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 text-white text-sm">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span className="font-medium">{point.label}</span>
                          </div>
                          <div className="text-xs text-gray-300 mt-1">
                            {point.value.toLocaleString()} users
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsRotating(!isRotating)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
            >
              <Globe className="w-4 h-4" />
              {isRotating ? 'Pause' : 'Play'} Rotation
            </motion.button>
          </div>
        </div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16"
        >
          {[
            { label: 'Countries Served', value: '150+', icon: Globe },
            { label: 'Global Users', value: '2.5M+', icon: Users },
            { label: 'Data Centers', value: '25+', icon: Zap }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 + index * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                <stat.icon className="w-8 h-8 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-gray-300">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
} 