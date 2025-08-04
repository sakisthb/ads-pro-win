'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface EnhancedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'gradient' | 'minimal'
  label?: string
  error?: string
  helperText?: string
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
  autoResize?: boolean
  maxLength?: number
  showCount?: boolean
}

const EnhancedTextarea = React.forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  ({
    variant = 'default',
    label,
    error,
    helperText,
    resize = 'vertical',
    autoResize = false,
    maxLength,
    showCount = false,
    className,
    value,
    defaultValue,
    onChange,
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)
    const [currentValue, setCurrentValue] = React.useState(
      (value || defaultValue || '') as string
    )
    const textareaRef = React.useRef<HTMLTextAreaElement>(null)

    const variants = {
      default: 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:border-purple-500 focus:ring-purple-500/20',
      gradient: 'border-0 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 focus:ring-purple-500/30',
      minimal: 'border-0 bg-gray-50 dark:bg-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:ring-purple-500/20'
    }

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize'
    }

    // Auto-resize functionality
    const adjustHeight = () => {
      if (autoResize && textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
      }
    }

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      
      // Enforce max length
      if (maxLength && newValue.length > maxLength) {
        return
      }
      
      setCurrentValue(newValue)
      adjustHeight()
      onChange?.(e)
    }

    React.useEffect(() => {
      if (value !== undefined) {
        setCurrentValue(value as string)
      }
    }, [value])

    React.useEffect(() => {
      adjustHeight()
    }, [currentValue, autoResize])

    const characterCount = currentValue.length
    const isOverLimit = maxLength ? characterCount > maxLength : false

    return (
      <div className="relative w-full">
        {/* Label */}
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {label}
          </label>
        )}

        {/* Textarea */}
        <motion.textarea
          ref={(node) => {
            textareaRef.current = node
            if (typeof ref === 'function') {
              ref(node)
            } else if (ref) {
              ref.current = node
            }
          }}
          className={cn(
            // Base styles
            'w-full rounded-lg px-4 py-3 text-base transition-all duration-200 ease-in-out',
            'placeholder:text-gray-400 dark:placeholder:text-gray-500',
            'text-gray-900 dark:text-gray-100',
            'focus:outline-none focus:ring-2',
            'min-h-[80px]',
            
            // Variant styles
            variants[variant],
            
            // Resize styles
            resizeClasses[resize],
            
            // Error state
            {
              'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20': error,
            },
            
            className
          )}
          value={currentValue}
          onFocus={(e) => {
            setIsFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setIsFocused(false)
            props.onBlur?.(e)
          }}
          onChange={handleChange}
          initial={{ scale: 0.98 }}
          animate={{ scale: isFocused ? 1.01 : 1 }}
          transition={{ duration: 0.2 }}
          {...props}
        />

        {/* Helper Text and Character Count */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex-1">
            {/* Helper Text */}
            {helperText && !error && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {helperText}
              </p>
            )}
            
            {/* Error Message */}
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </motion.p>
            )}
          </div>

          {/* Character Count */}
          {showCount && maxLength && (
            <motion.div
              className={cn(
                'text-sm transition-colors duration-200',
                {
                  'text-gray-500 dark:text-gray-400': !isOverLimit,
                  'text-red-500 dark:text-red-400': isOverLimit,
                }
              )}
              animate={{ 
                scale: isOverLimit ? 1.1 : 1,
                color: isOverLimit ? '#ef4444' : '#6b7280'
              }}
            >
              {characterCount}/{maxLength}
            </motion.div>
          )}
        </div>
      </div>
    )
  }
)

EnhancedTextarea.displayName = 'EnhancedTextarea'

export { EnhancedTextarea, type EnhancedTextareaProps }