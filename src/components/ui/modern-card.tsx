'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ModernCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient' | 'glass' | 'elevated' | 'bordered'
  hover?: boolean
  children: React.ReactNode
}

const ModernCard = React.forwardRef<HTMLDivElement, ModernCardProps>(
  ({
    variant = 'default',
    hover = true,
    children,
    className,
    onClick,
    ...props
  }, ref) => {
    const variants = {
      default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm',
      gradient: 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/30',
      glass: 'bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm border border-white/20 dark:border-gray-700/20 shadow-lg',
      elevated: 'bg-white dark:bg-gray-800 border-0 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50',
      bordered: 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow-none',
    }

    const hoverEffects = hover ? {
      whileHover: { 
        y: -4,
        scale: 1.02,
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
      },
      transition: { duration: 0.2 }
    } : {}

    return (
      <motion.div
        ref={ref}
        className={cn(
          // Base styles
          'rounded-xl p-6 transition-all duration-200',
          
          // Variant styles
          variants[variant],
          
          // Interactive styles
          {
            'cursor-pointer': onClick,
            'hover:shadow-xl': hover && !onClick,
          },
          
          className
        )}
        onClick={onClick}
        {...hoverEffects}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

ModernCard.displayName = 'ModernCard'

export { ModernCard, type ModernCardProps }