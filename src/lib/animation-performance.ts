// CSS Animation Performance Optimization - Phase 3 Week 9
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

// Animation performance configuration
interface AnimationConfig {
  duration: number;
  easing: string;
  delay: number;
  fillMode: 'none' | 'forwards' | 'backwards' | 'both';
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  iterationCount: number | 'infinite';
  playState: 'running' | 'paused';
}

interface PerformanceSettings {
  useGPU: boolean;
  useTransforms: boolean;
  reduceMotion: boolean;
  batchAnimations: boolean;
  enableWillChange: boolean;
  frameRate: number;
}

// Performance-optimized animation utilities
class AnimationPerformanceManager {
  private static instance: AnimationPerformanceManager;
  private animationFrameId: number | null = null;
  private animationQueue: Array<() => void> = [];
  private isProcessingQueue = false;
  private performanceSettings: PerformanceSettings;

  constructor() {
    this.performanceSettings = {
      useGPU: this.detectGPUSupport(),
      useTransforms: true,
      reduceMotion: this.detectReducedMotion(),
      batchAnimations: true,
      enableWillChange: true,
      frameRate: this.getOptimalFrameRate(),
    };
  }

  static getInstance(): AnimationPerformanceManager {
    if (!AnimationPerformanceManager.instance) {
      AnimationPerformanceManager.instance = new AnimationPerformanceManager();
    }
    return AnimationPerformanceManager.instance;
  }

  private detectGPUSupport(): boolean {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return gl !== null;
  }

  private detectReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  }

  private getOptimalFrameRate(): number {
    // Detect display refresh rate
    let refreshRate = 60;
    if ('screen' in window && 'orientation' in screen) {
      // Modern browsers may provide refresh rate info
      refreshRate = (screen as any).refreshRate || 60;
    }
    return Math.min(refreshRate, 60); // Cap at 60fps for battery life
  }

  // Queue animations to batch them
  queueAnimation(callback: () => void): void {
    this.animationQueue.push(callback);
    
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  private processQueue(): void {
    this.isProcessingQueue = true;
    
    this.animationFrameId = requestAnimationFrame(() => {
      // Process all queued animations in a single frame
      const callbacks = [...this.animationQueue];
      this.animationQueue.length = 0;
      
      callbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Animation callback error:', error);
        }
      });
      
      this.isProcessingQueue = false;
      
      // Continue processing if more animations were queued
      if (this.animationQueue.length > 0) {
        this.processQueue();
      }
    });
  }

  // Generate GPU-accelerated CSS
  generateGPUOptimizedCSS(properties: Record<string, any>): Record<string, any> {
    const optimized: Record<string, any> = { ...properties };

    if (this.performanceSettings.useGPU) {
      // Force GPU layer creation
      optimized.transform = optimized.transform || 'translateZ(0)';
      optimized.backfaceVisibility = 'hidden';
      optimized.perspective = optimized.perspective || '1000px';
    }

    if (this.performanceSettings.enableWillChange) {
      // Optimize for expected changes
      const animatedProps = [];
      if (optimized.transform) animatedProps.push('transform');
      if (optimized.opacity !== undefined) animatedProps.push('opacity');
      if (optimized.filter) animatedProps.push('filter');
      
      if (animatedProps.length > 0) {
        optimized.willChange = animatedProps.join(', ');
      }
    }

    return optimized;
  }

  getSettings(): PerformanceSettings {
    return { ...this.performanceSettings };
  }

  updateSettings(settings: Partial<PerformanceSettings>): void {
    this.performanceSettings = { ...this.performanceSettings, ...settings };
  }
}

// High-performance animation hooks
export function useOptimizedAnimation(
  elementRef: React.RefObject<HTMLElement | null>,
  config: Partial<AnimationConfig> = {}
) {
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<Animation | null>(null);
  const manager = AnimationPerformanceManager.getInstance();

  const defaultConfig: AnimationConfig = {
    duration: 300,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    delay: 0,
    fillMode: 'forwards',
    direction: 'normal',
    iterationCount: 1,
    playState: 'running',
  };

  const finalConfig = { ...defaultConfig, ...config };

  const animate = useCallback((
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options?: Partial<AnimationConfig>
  ) => {
    if (!elementRef.current) return Promise.resolve();

    const settings = manager.getSettings();
    if (settings.reduceMotion) {
      // Skip animation if user prefers reduced motion
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      manager.queueAnimation(() => {
        if (!elementRef.current) {
          resolve();
          return;
        }

        const animationOptions = { ...finalConfig, ...options };
        
        // Create Web Animations API animation
        animationRef.current = elementRef.current.animate(keyframes, {
          duration: animationOptions.duration,
          easing: animationOptions.easing,
          delay: animationOptions.delay,
          fill: animationOptions.fillMode,
          direction: animationOptions.direction,
          iterations: animationOptions.iterationCount === 'infinite' ? Infinity : animationOptions.iterationCount,
        });

        setIsAnimating(true);

        animationRef.current.addEventListener('finish', () => {
          setIsAnimating(false);
          resolve();
        });

        animationRef.current.addEventListener('cancel', () => {
          setIsAnimating(false);
          resolve();
        });
      });
    });
  }, [elementRef, finalConfig, manager]);

  const pause = useCallback(() => {
    animationRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    animationRef.current?.play();
  }, []);

  const cancel = useCallback(() => {
    animationRef.current?.cancel();
    setIsAnimating(false);
  }, []);

  useEffect(() => {
    return () => {
      animationRef.current?.cancel();
    };
  }, []);

  return {
    animate,
    pause,
    resume,
    cancel,
    isAnimating,
    animation: animationRef.current,
  };
}

// Performance-optimized transition hook
export function useOptimizedTransition(
  trigger: boolean,
  options: {
    duration?: number;
    easing?: string;
    enterKeyframes?: Keyframe[];
    exitKeyframes?: Keyframe[];
  } = {}
) {
  const [isVisible, setIsVisible] = useState(trigger);
  const [isAnimating, setIsAnimating] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const { animate } = useOptimizedAnimation(elementRef);

  const {
    duration = 300,
    easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
    enterKeyframes = [
      { opacity: 0, transform: 'scale(0.95)' },
      { opacity: 1, transform: 'scale(1)' }
    ],
    exitKeyframes = [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.95)' }
    ],
  } = options;

  useEffect(() => {
    if (trigger && !isVisible) {
      // Enter animation
      setIsVisible(true);
      setIsAnimating(true);
      
      animate(enterKeyframes, { duration, easing }).then(() => {
        setIsAnimating(false);
      });
    } else if (!trigger && isVisible) {
      // Exit animation
      setIsAnimating(true);
      
      animate(exitKeyframes, { duration, easing }).then(() => {
        setIsVisible(false);
        setIsAnimating(false);
      });
    }
  }, [trigger, isVisible, animate, duration, easing, enterKeyframes, exitKeyframes]);

  return {
    elementRef,
    isVisible,
    isAnimating,
  };
}

// Optimized scroll-triggered animations
export function useScrollAnimation(
  options: {
    threshold?: number;
    rootMargin?: string;
    once?: boolean;
    keyframes?: Keyframe[];
    duration?: number;
    stagger?: number; // Delay between multiple elements
  } = {}
) {
  const [isInView, setIsInView] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const { animate } = useOptimizedAnimation(elementRef);

  const {
    threshold = 0.1,
    rootMargin = '0px',
    once = true,
    keyframes = [
      { opacity: 0, transform: 'translateY(20px)' },
      { opacity: 1, transform: 'translateY(0px)' }
    ],
    duration = 600,
    stagger = 0,
  } = options;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          
          if (!hasAnimated) {
            setTimeout(() => {
              animate(keyframes, { duration });
            }, stagger);
            
            if (once) {
              setHasAnimated(true);
            }
          }
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin }
    );

    const element = elementRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold, rootMargin, once, animate, keyframes, duration, stagger, hasAnimated]);

  return {
    elementRef,
    isInView,
    hasAnimated,
  };
}

// Performance-optimized CSS animations
export const performantAnimations = {
  // GPU-accelerated transforms
  fadeIn: {
    from: { opacity: 0, transform: 'translateZ(0)' },
    to: { opacity: 1, transform: 'translateZ(0)' },
  },
  
  slideUp: {
    from: { opacity: 0, transform: 'translate3d(0, 20px, 0)' },
    to: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  },
  
  slideDown: {
    from: { opacity: 0, transform: 'translate3d(0, -20px, 0)' },
    to: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  },
  
  slideLeft: {
    from: { opacity: 0, transform: 'translate3d(20px, 0, 0)' },
    to: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  },
  
  slideRight: {
    from: { opacity: 0, transform: 'translate3d(-20px, 0, 0)' },
    to: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  },
  
  scaleIn: {
    from: { opacity: 0, transform: 'scale3d(0.9, 0.9, 1)' },
    to: { opacity: 1, transform: 'scale3d(1, 1, 1)' },
  },
  
  rotateIn: {
    from: { opacity: 0, transform: 'rotate3d(0, 0, 1, -10deg)' },
    to: { opacity: 1, transform: 'rotate3d(0, 0, 1, 0deg)' },
  },
  
  bounce: {
    '0%': { transform: 'scale3d(1, 1, 1)' },
    '30%': { transform: 'scale3d(1.25, 0.75, 1)' },
    '40%': { transform: 'scale3d(0.75, 1.25, 1)' },
    '50%': { transform: 'scale3d(1.15, 0.85, 1)' },
    '65%': { transform: 'scale3d(0.95, 1.05, 1)' },
    '75%': { transform: 'scale3d(1.05, 0.95, 1)' },
    '100%': { transform: 'scale3d(1, 1, 1)' },
  },
};

// CSS-in-JS optimized styles generator
export function generateOptimizedStyles(
  animations: Record<string, any>,
  options: {
    useGPU?: boolean;
    enableWillChange?: boolean;
    duration?: number;
    timingFunction?: string;
  } = {}
) {
  const manager = AnimationPerformanceManager.getInstance();
  const settings = manager.getSettings();
  
  const {
    useGPU = settings.useGPU,
    enableWillChange = settings.enableWillChange,
    duration = 300,
    timingFunction = 'cubic-bezier(0.4, 0, 0.2, 1)',
  } = options;

  const optimizedStyles: Record<string, any> = {};

  Object.entries(animations).forEach(([name, keyframes]) => {
    optimizedStyles[name] = {
      animationName: name,
      animationDuration: `${duration}ms`,
      animationTimingFunction: timingFunction,
      animationFillMode: 'forwards',
      ...manager.generateGPUOptimizedCSS({}),
    };

    // Generate keyframes
    if (typeof keyframes === 'object' && keyframes.from && keyframes.to) {
      optimizedStyles[`@keyframes ${name}`] = {
        from: manager.generateGPUOptimizedCSS(keyframes.from),
        to: manager.generateGPUOptimizedCSS(keyframes.to),
      };
    } else if (typeof keyframes === 'object') {
      optimizedStyles[`@keyframes ${name}`] = Object.entries(keyframes).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: manager.generateGPUOptimizedCSS(value as any),
        }),
        {}
      );
    }
  });

  return optimizedStyles;
}

// Utility for reducing animations based on user preferences
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

// Export manager instance
export const animationManager = AnimationPerformanceManager.getInstance();

// Export utilities
export {
  AnimationPerformanceManager,
};