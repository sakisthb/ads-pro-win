'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface EnhancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'gradient' | 'floating' | 'underline'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  error?: string
  label?: string
  animate?: boolean
}

const EnhancedInput = React.forwardRef<HTMLInputElement, EnhancedInputProps>(
  ({
    variant = 'default',
    size = 'md',
    icon,
    error,
    label,
    animate = true,
    className,
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [hasValue, setHasValue] = React.useState(Boolean(props.value || props.defaultValue))

    const variants = {
      default: 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-purple-500 focus:ring-purple-500/20',
      gradient: 'border-0 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 focus:ring-purple-500/30',
      floating: 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-purple-500',
      underline: 'border-0 border-b-2 border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500 rounded-none'
    }

    const sizes = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-5 py-4 text-lg'
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(Boolean(e.target.value))
      props.onChange?.(e)
    }

    const InputComponent = animate ? motion.input : 'input'
    const animationProps = animate ? {
      initial: { scale: 0.98 },
      animate: { scale: isFocused ? 1.02 : 1 },
      transition: { duration: 0.2 }
    } : {}

    return (
      <div className="relative w-full">
        {/* Standard Label */}
        {label && variant !== 'floating' && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {label}
          </label>
        )}

        <div className="relative">
          {/* Icon */}
          {icon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
              {icon}
            </div>
          )}

          {/* Input */}
          <InputComponent
            ref={ref}
            className={cn(
              // Base styles
              'w-full rounded-lg transition-all duration-200 ease-in-out',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'text-gray-900 dark:text-gray-100',
              'focus:outline-none focus:ring-2',
              
              // Variant styles
              variants[variant],
              
              // Size styles
              sizes[size],
              
              // Icon padding
              { 'pl-10': icon },
              
              // Error state
              {
                'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20': error,
              },
              
              className
            )}
            onFocus={(e) => {
              setIsFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setIsFocused(false)
              props.onBlur?.(e)
            }}
            onChange={handleChange}
            {...animationProps}
            {...props}
          />

          {/* Floating Label */}
          {label && variant === 'floating' && (
            <motion.label
              className={cn(
                'absolute left-4 transition-all duration-200 pointer-events-none',
                'text-gray-500 dark:text-gray-400',
                {
                  'top-1/2 -translate-y-1/2 text-base': !isFocused && !hasValue,
                  'top-2 text-xs text-purple-600 dark:text-purple-400': isFocused || hasValue,
                }
              )}
              animate={{
                y: isFocused || hasValue ? -8 : 0,
                scale: isFocused || hasValue ? 0.85 : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              {label}
            </motion.label>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-sm text-red-600 dark:text-red-400"
          >
            {error}
          </motion.p>
        )}
      </div>
    )
  }
)

EnhancedInput.displayName = 'EnhancedInput'

export { EnhancedInput, type EnhancedInputProps }