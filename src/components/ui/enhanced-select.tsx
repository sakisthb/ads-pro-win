'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDownIcon, CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface EnhancedSelectProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'gradient' | 'minimal'
  className?: string
  onChange?: (value: string) => void
}

const EnhancedSelect = React.forwardRef<HTMLButtonElement, EnhancedSelectProps>(
  ({
    options,
    value,
    defaultValue,
    placeholder = 'Select an option...',
    label,
    error,
    disabled = false,
    size = 'md',
    variant = 'default',
    className,
    onChange,
    ...props
  }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedValue, setSelectedValue] = React.useState(value || defaultValue || '')
    const [focusedIndex, setFocusedIndex] = React.useState(-1)

    const selectedOption = options.find(option => option.value === selectedValue)

    const variants = {
      default: 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-600',
      gradient: 'border-0 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 hover:from-purple-100 hover:to-blue-100',
      minimal: 'border-0 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
    }

    const sizes = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-5 py-4 text-lg'
    }

    const handleSelect = (option: SelectOption) => {
      if (option.disabled) return
      
      setSelectedValue(option.value)
      setIsOpen(false)
      onChange?.(option.value)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (isOpen && focusedIndex >= 0) {
            handleSelect(options[focusedIndex])
          } else {
            setIsOpen(!isOpen)
          }
          break
        case 'ArrowDown':
          e.preventDefault()
          if (!isOpen) {
            setIsOpen(true)
          } else {
            setFocusedIndex(prev => 
              prev < options.length - 1 ? prev + 1 : 0
            )
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (isOpen) {
            setFocusedIndex(prev => 
              prev > 0 ? prev - 1 : options.length - 1
            )
          }
          break
        case 'Escape':
          setIsOpen(false)
          setFocusedIndex(-1)
          break
      }
    }

    React.useEffect(() => {
      if (value !== undefined) {
        setSelectedValue(value)
      }
    }, [value])

    return (
      <div className="relative w-full">
        {/* Label */}
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {label}
          </label>
        )}

        {/* Select Button */}
        <motion.button
          ref={ref}
          type="button"
          className={cn(
            // Base styles
            'relative w-full rounded-lg text-left transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-purple-500/20',
            'flex items-center justify-between',
            
            // Variant styles
            variants[variant],
            
            // Size styles
            sizes[size],
            
            // State styles
            {
              'opacity-50 cursor-not-allowed': disabled,
              'cursor-pointer': !disabled,
              'ring-2 ring-purple-500/20': isOpen,
              'border-red-300 dark:border-red-600': error,
            },
            
            className
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          whileTap={{ scale: disabled ? 1 : 0.98 }}
          {...props}
        >
          <span className={cn(
            'block truncate',
            selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
          )}>
            {selectedOption?.label || placeholder}
          </span>
          
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          </motion.div>
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 mt-2 w-full rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
            >
              <div className="max-h-60 overflow-auto py-1">
                {options.map((option, index) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    className={cn(
                      'relative w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                      'flex items-center justify-between',
                      {
                        'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400': 
                          selectedValue === option.value,
                        'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700': 
                          selectedValue !== option.value && !option.disabled,
                        'text-gray-400 dark:text-gray-500 cursor-not-allowed': option.disabled,
                        'bg-gray-50 dark:bg-gray-700': focusedIndex === index && !option.disabled,
                      }
                    )}
                    onClick={() => handleSelect(option)}
                    disabled={option.disabled}
                    whileHover={!option.disabled ? { backgroundColor: 'rgba(147, 51, 234, 0.05)' } : {}}
                  >
                    <span className="block truncate">{option.label}</span>
                    {selectedValue === option.value && (
                      <CheckIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

        {/* Click outside handler */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>
    )
  }
)

EnhancedSelect.displayName = 'EnhancedSelect'

export { EnhancedSelect, type EnhancedSelectProps, type SelectOption }