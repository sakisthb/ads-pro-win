'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'

interface EnhancedTooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'gradient'
  size?: 'sm' | 'md' | 'lg'
  showArrow?: boolean
  delay?: number
  className?: string
  trigger?: 'hover' | 'click' | 'focus'
  maxWidth?: number
}

interface EnhancedTooltipContentProps {
  content: React.ReactNode
  position: string
  variant: string
  size: string
  showArrow: boolean
  maxWidth?: number
}

const tooltipVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 5 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  exit: { 
    opacity: 0, 
    scale: 0.8, 
    y: 5,
    transition: { duration: 0.15, ease: 'easeIn' }
  }
}

const positionClasses = {
  top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  'top-left': 'bottom-full right-0 mb-2',
  'top-right': 'bottom-full left-0 mb-2',
  'bottom-left': 'top-full right-0 mt-2',
  'bottom-right': 'top-full left-0 mt-2'
}

const arrowClasses = {
  top: 'top-full left-1/2 transform -translate-x-1/2 border-t-gray-800 dark:border-t-gray-200',
  bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-800 dark:border-b-gray-200',
  left: 'left-full top-1/2 transform -translate-y-1/2 border-l-gray-800 dark:border-l-gray-200',
  right: 'right-full top-1/2 transform -translate-y-1/2 border-r-gray-800 dark:border-r-gray-200',
  'top-left': 'top-full right-2 border-t-gray-800 dark:border-t-gray-200',
  'top-right': 'top-full left-2 border-t-gray-800 dark:border-t-gray-200',
  'bottom-left': 'bottom-full right-2 border-b-gray-800 dark:border-b-gray-200',
  'bottom-right': 'bottom-full left-2 border-b-gray-800 dark:border-b-gray-200'
}

const variantClasses = {
  default: 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800',
  success: 'bg-green-600 text-white',
  warning: 'bg-yellow-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  gradient: 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
}

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-2',
  lg: 'text-base px-4 py-3'
}

const EnhancedTooltipContent: React.FC<EnhancedTooltipContentProps> = ({
  content,
  position,
  variant,
  size,
  showArrow,
  maxWidth
}) => {
  return (
    <motion.div
      variants={tooltipVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        'absolute z-50 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
        positionClasses[position as keyof typeof positionClasses],
        variantClasses[variant as keyof typeof variantClasses],
        sizeClasses[size as keyof typeof sizeClasses],
        'whitespace-nowrap'
      )}
      style={{ maxWidth: maxWidth }}
    >
      {content}
      
      {showArrow && (
        <div
          className={cn(
            'absolute w-0 h-0 border-4 border-transparent',
            arrowClasses[position as keyof typeof arrowClasses]
          )}
        />
      )}
    </motion.div>
  )
}

export const EnhancedTooltip: React.FC<EnhancedTooltipProps> = ({
  children,
  content,
  position = 'top',
  variant = 'default',
  size = 'md',
  showArrow = true,
  delay = 200,
  className = '',
  trigger = 'hover',
  maxWidth
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    setIsVisible(false)
  }

  const handleMouseEnter = () => {
    if (trigger === 'hover') {
      showTooltip()
    }
  }

  const handleMouseLeave = () => {
    if (trigger === 'hover') {
      hideTooltip()
    }
  }

  const handleClick = () => {
    if (trigger === 'click') {
      setIsVisible(!isVisible)
    }
  }

  const handleFocus = () => {
    if (trigger === 'focus') {
      showTooltip()
    }
  }

  const handleBlur = () => {
    if (trigger === 'focus') {
      hideTooltip()
    }
  }

  // Close tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false)
      }
    }

    if (trigger === 'click' && isVisible) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [trigger, isVisible])

  const tooltipContent = (
    <div className="relative inline-block" ref={triggerRef}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn('inline-block', className)}
      >
        {children}
      </div>

      <AnimatePresence>
        {isVisible && (
          <div ref={tooltipRef}>
            <EnhancedTooltipContent
              content={content}
              position={position}
              variant={variant}
              size={size}
              showArrow={showArrow}
              maxWidth={maxWidth}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  )

  // Use portal for better positioning
  if (typeof window !== 'undefined') {
    return createPortal(tooltipContent, document.body)
  }

  return tooltipContent
}

export const EnhancedInfoTooltip: React.FC<{
  children: React.ReactNode
  title: string
  description?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
}> = ({
  children,
  title,
  description,
  position = 'top',
  size = 'md'
}) => {
  const content = (
    <div className="text-center">
      <div className="font-medium">{title}</div>
      {description && (
        <div className="text-xs opacity-90 mt-1">{description}</div>
      )}
    </div>
  )

  return (
    <EnhancedTooltip
      content={content}
      position={position}
      variant="info"
      size={size}
      trigger="hover"
    >
      {children}
    </EnhancedTooltip>
  )
}

export const EnhancedHelpTooltip: React.FC<{
  children: React.ReactNode
  helpText: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}> = ({
  children,
  helpText,
  position = 'top'
}) => {
  return (
    <EnhancedTooltip
      content={helpText}
      position={position}
      variant="default"
      size="sm"
      trigger="hover"
    >
      {children}
    </EnhancedTooltip>
  )
} 