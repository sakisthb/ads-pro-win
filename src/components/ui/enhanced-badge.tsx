'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface EnhancedBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gradient' | 'glow'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  animate?: boolean
  icon?: React.ReactNode
}

const EnhancedBadge = React.forwardRef<HTMLSpanElement, EnhancedBadgeProps>(
  ({
    variant = 'default',
    size = 'md',
    children,
    animate = false,
    icon,
    className,
    ...props
  }, ref) => {
    const variants = {
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600',
      success: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800',
      error: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
      gradient: 'bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0 shadow-lg shadow-purple-500/25',
      glow: 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700 shadow-lg shadow-purple-500/20',
    }

    const sizes = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1 text-sm',
      lg: 'px-4 py-2 text-base',
    }

    const BadgeComponent = animate ? motion.span : 'span'
    const animationProps = animate ? {
      initial: { scale: 0.8, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      transition: { duration: 0.2 }
    } : {}

    return (
      <BadgeComponent
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex items-center rounded-full font-medium transition-all duration-200',
          
          // Variant styles
          variants[variant],
          
          // Size styles
          sizes[size],
          
          // Hover effects
          'hover:scale-105',
          
          className
        )}
        {...animationProps}
        {...props}
      >
        {icon && (
          <span className={cn('mr-1', size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4')}>
            {icon}
          </span>
        )}
        {children}
      </BadgeComponent>
    )
  }
)

EnhancedBadge.displayName = 'EnhancedBadge'

export { EnhancedBadge, type EnhancedBadgeProps }