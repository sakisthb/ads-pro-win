'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { EnhancedInput } from './enhanced-input'
import { EnhancedSelect } from './enhanced-select'
import { EnhancedTextarea } from './enhanced-textarea'
import { EnhancedBadge } from './enhanced-badge'
import { GradientButton } from './gradient-button'

interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'select' | 'textarea' | 'checkbox' | 'radio'
  placeholder?: string
  required?: boolean
  validation?: {
    pattern?: RegExp
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    custom?: (value: string) => string | null
  }
  options?: Array<{ value: string; label: string }>
  helpText?: string
  errorText?: string
}

interface EnhancedFormProps {
  fields: FormField[]
  onSubmit: (data: Record<string, any>) => void
  submitText?: string
  variant?: 'default' | 'gradient' | 'glass'
  layout?: 'vertical' | 'horizontal' | 'grid'
  showValidation?: boolean
  className?: string
}

interface FormErrors {
  [key: string]: string
}

export const EnhancedForm: React.FC<EnhancedFormProps> = ({
  fields,
  onSubmit,
  submitText = 'Submit',
  variant = 'default',
  layout = 'vertical',
  showValidation = true,
  className = ''
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<FormErrors>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const variants = {
    default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
    gradient: 'bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700',
    glass: 'bg-white/10 dark:bg-gray-800/10 backdrop-blur-sm border border-white/20 dark:border-gray-700/20'
  }

  const layoutClasses = {
    vertical: 'space-y-6',
    horizontal: 'grid grid-cols-1 md:grid-cols-2 gap-6',
    grid: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
  }

  const validateField = (field: FormField, value: any): string | null => {
    if (field.required && !value) {
      return field.errorText || `${field.label} is required`
    }

    if (!value) return null

    if (field.validation) {
      const { validation } = field

      if (validation.pattern && !validation.pattern.test(value)) {
        return field.errorText || `${field.label} format is invalid`
      }

      if (validation.minLength && value.length < validation.minLength) {
        return field.errorText || `${field.label} must be at least ${validation.minLength} characters`
      }

      if (validation.maxLength && value.length > validation.maxLength) {
        return field.errorText || `${field.label} must be no more than ${validation.maxLength} characters`
      }

      if (validation.min && Number(value) < validation.min) {
        return field.errorText || `${field.label} must be at least ${validation.min}`
      }

      if (validation.max && Number(value) > validation.max) {
        return field.errorText || `${field.label} must be no more than ${validation.max}`
      }

      if (validation.custom) {
        const customError = validation.custom(value)
        if (customError) return customError
      }
    }

    return null
  }

  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    
    if (showValidation && touched[name]) {
      const field = fields.find(f => f.name === name)
      if (field) {
        const error = validateField(field, value)
        setErrors(prev => ({ ...prev, [name]: error || '' }))
      }
    }
  }

  const handleFieldBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    
    if (showValidation) {
      const field = fields.find(f => f.name === name)
      if (field) {
        const error = validateField(field, formData[name])
        setErrors(prev => ({ ...prev, [name]: error || '' }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate all fields
    const newErrors: FormErrors = {}
    fields.forEach(field => {
      const error = validateField(field, formData[field.name])
      if (error) {
        newErrors[field.name] = error
      }
    })

    setErrors(newErrors)
    setTouched(fields.reduce((acc, field) => ({ ...acc, [field.name]: true }), {}))

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true)
      try {
        await onSubmit(formData)
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const renderField = (field: FormField) => {
    const hasError = errors[field.name] && touched[field.name]
    const isTouched = touched[field.name]

    const commonProps = {
      value: formData[field.name] || '',
      onChange: (value: any) => handleFieldChange(field.name, value),
      onBlur: () => handleFieldBlur(field.name),
      error: hasError ? errors[field.name] : undefined,
      className: 'w-full'
    }

    switch (field.type) {
      case 'select':
        return (
          <EnhancedSelect
            {...commonProps}
            placeholder={field.placeholder}
            options={field.options || []}
          />
        )

      case 'textarea':
        return (
          <EnhancedTextarea
            {...commonProps}
            placeholder={field.placeholder}
            label={field.label}
          />
        )

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={field.name}
              checked={formData[field.name] || false}
              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2"
            />
            <label htmlFor={field.name} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {field.label}
            </label>
          </div>
        )

      case 'radio':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {field.label}
            </label>
            <div className="space-y-2">
              {field.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`${field.name}-${option.value}`}
                    name={field.name}
                    value={option.value}
                    checked={formData[field.name] === option.value}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 focus:ring-purple-500 dark:focus:ring-purple-600 dark:ring-offset-gray-800 focus:ring-2"
                  />
                  <label htmlFor={`${field.name}-${option.value}`} className="text-sm text-gray-700 dark:text-gray-300">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )

      default:
        return (
          <EnhancedInput
            {...commonProps}
            type={field.type}
            placeholder={field.placeholder}
            label={field.label}
          />
        )
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className={cn(
        'rounded-xl p-6 shadow-lg',
        variants[variant],
        layoutClasses[layout],
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {fields.map((field, index) => (
        <motion.div
          key={field.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          className="space-y-2"
        >
          {renderField(field)}
          
          {field.helpText && !errors[field.name] && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {field.helpText}
            </p>
          )}
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: fields.length * 0.1 }}
        className="flex items-center justify-between pt-6"
      >
        <div className="flex items-center space-x-2">
          {showValidation && Object.keys(errors).length > 0 && (
            <EnhancedBadge variant="error" size="sm">
              {Object.keys(errors).length} error{Object.keys(errors).length > 1 ? 's' : ''}
            </EnhancedBadge>
          )}
        </div>

        <GradientButton
          type="submit"
          disabled={isSubmitting}
          className="min-w-[120px]"
        >
          {isSubmitting ? 'Submitting...' : submitText}
        </GradientButton>
      </motion.div>
    </motion.form>
  )
}

export const EnhancedFormSection: React.FC<{
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
}> = ({
  children,
  title,
  description,
  className = ''
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {(title || description) && (
        <div className="space-y-2">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  )
} 