'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useTheme } from '@/components/providers/theme-provider'

interface EnhancedLayoutProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'gradient' | 'glass' | 'minimal'
  showBackground?: boolean
  showPattern?: boolean
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

interface EnhancedContainerProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
}

interface EnhancedSectionProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'gradient' | 'glass' | 'minimal'
  showBackground?: boolean
  showPattern?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  id?: string
}

export const EnhancedLayout: React.FC<EnhancedLayoutProps> = ({
  children,
  className = '',
  variant = 'default',
  showBackground = true,
  showPattern = false,
  maxWidth = 'xl',
  padding = 'lg'
}) => {
  const { theme } = useTheme()

  const variants = {
    default: 'bg-white dark:bg-gray-900',
    gradient: 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20',
    glass: 'bg-white/10 dark:bg-gray-900/10 backdrop-blur-sm',
    minimal: 'bg-transparent'
  }

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  }

  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-12'
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    }
  }

  return (
    <motion.div
      className={cn(
        'min-h-screen transition-all duration-300',
        variants[variant],
        className
      )}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Background Pattern */}
      {showPattern && (
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
        </div>
      )}

      {/* Content */}
      <div className={cn(
        'relative mx-auto',
        maxWidths[maxWidth],
        paddings[padding]
      )}>
        {children}
      </div>
    </motion.div>
  )
}

export const EnhancedContainer: React.FC<EnhancedContainerProps> = ({
  children,
  className = '',
  maxWidth = 'xl',
  padding = 'lg'
}) => {
  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-7xl',
    full: 'max-w-full'
  }

  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-12'
  }

  return (
    <div className={cn(
      'mx-auto',
      maxWidths[maxWidth],
      paddings[padding],
      className
    )}>
      {children}
    </div>
  )
}

export const EnhancedSection: React.FC<EnhancedSectionProps> = ({
  children,
  className = '',
  variant = 'default',
  showBackground = true,
  showPattern = false,
  padding = 'lg',
  id
}) => {
  const { theme } = useTheme()

  const variants = {
    default: 'bg-white dark:bg-gray-900',
    gradient: 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20',
    glass: 'bg-white/10 dark:bg-gray-900/10 backdrop-blur-sm',
    minimal: 'bg-transparent'
  }

  const paddings = {
    none: 'py-0',
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-16',
    xl: 'py-24'
  }

  const sectionVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  }

  return (
    <motion.section
      id={id}
      className={cn(
        'relative overflow-hidden',
        showBackground && variants[variant],
        paddings[padding],
        className
      )}
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      {/* Background Pattern */}
      {showPattern && (
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.1%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.section>
  )
}

export const EnhancedGrid: React.FC<{
  children: React.ReactNode
  className?: string
  cols?: 1 | 2 | 3 | 4 | 5 | 6
  gap?: 'sm' | 'md' | 'lg' | 'xl'
  responsive?: boolean
}> = ({
  children,
  className = '',
  cols = 3,
  gap = 'lg',
  responsive = true
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
  }

  const gaps = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-12'
  }

  return (
    <div className={cn(
      'grid',
      responsive ? gridCols[cols] : `grid-cols-${cols}`,
      gaps[gap],
      className
    )}>
      {children}
    </div>
  )
}

export const EnhancedFlex: React.FC<{
  children: React.ReactNode
  className?: string
  direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse'
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly'
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch'
  wrap?: boolean
  gap?: 'sm' | 'md' | 'lg' | 'xl'
}> = ({
  children,
  className = '',
  direction = 'row',
  justify = 'start',
  align = 'start',
  wrap = false,
  gap = 'md'
}) => {
  const directions = {
    row: 'flex-row',
    col: 'flex-col',
    'row-reverse': 'flex-row-reverse',
    'col-reverse': 'flex-col-reverse'
  }

  const justifies = {
    start: 'justify-start',
    end: 'justify-end',
    center: 'justify-center',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly'
  }

  const aligns = {
    start: 'items-start',
    end: 'items-end',
    center: 'items-center',
    baseline: 'items-baseline',
    stretch: 'items-stretch'
  }

  const gaps = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  }

  return (
    <div className={cn(
      'flex',
      directions[direction],
      justifies[justify],
      aligns[align],
      wrap && 'flex-wrap',
      gaps[gap],
      className
    )}>
      {children}
    </div>
  )
} 