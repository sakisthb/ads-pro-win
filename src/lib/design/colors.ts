/**
 * Design System - Color Palette
 * Ads Pro Enterprise - Modern Color System
 */

export const colors = {
  // Primary Gradients
  gradients: {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    secondary: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    success: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    warning: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    info: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    danger: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
    
    // Special gradients
    hero: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
    card: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
    cardDark: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
  },

  // Dark Theme Colors
  dark: {
    background: '#0a0a0a',
    surface: '#1a1a1a',
    card: '#2a2a2a',
    border: '#3a3a3a',
    text: '#ffffff',
    textSecondary: '#a0a0a0',
    textMuted: '#6b7280',
    accent: '#667eea',
    accentSecondary: '#764ba2',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // Light Theme Colors
  light: {
    background: '#ffffff',
    surface: '#f8f9fa',
    card: '#ffffff',
    border: '#e9ecef',
    text: '#212529',
    textSecondary: '#6c757d',
    textMuted: '#9ca3af',
    accent: '#667eea',
    accentSecondary: '#764ba2',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#2563eb',
  },

  // Brand Colors
  brand: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#f093fb',
    highlight: '#00f2fe',
  },

  // Functional Colors
  functional: {
    success: {
      light: '#d1fae5',
      DEFAULT: '#10b981',
      dark: '#047857',
    },
    warning: {
      light: '#fef3c7',
      DEFAULT: '#f59e0b',
      dark: '#d97706',
    },
    error: {
      light: '#fee2e2',
      DEFAULT: '#ef4444',
      dark: '#dc2626',
    },
    info: {
      light: '#dbeafe',
      DEFAULT: '#3b82f6',
      dark: '#2563eb',
    },
  },
};

export type ColorName = keyof typeof colors.brand;
export type GradientName = keyof typeof colors.gradients;