// Advanced Animation Performance Optimization - Phase 3 Week 9
import React, { 
  useRef, 
  useEffect, 
  useState, 
  useCallback, 
  useMemo,
  CSSProperties 
} from 'react';

// Types for animation optimization
interface AnimationConfig {
  duration?: number;
  easing?: string;
  delay?: number;
  fillMode?: 'none' | 'forwards' | 'backwards' | 'both';
  iterations?: number | 'infinite';
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  playState?: 'running' | 'paused';
}

interface SpringConfig {
  tension?: number;
  friction?: number;
  mass?: number;
  velocity?: number;
  precision?: number;
}

interface TransitionConfig {
  property: string;
  duration: number;
  easing: string;
  delay?: number;
}

interface AnimationState {
  isAnimating: boolean;
  progress: number;
  direction: 'forward' | 'reverse';
  iteration: number;
}

// Performance-optimized animation utilities
export class AnimationOptimizer {
  private static animationFrame: number | null = null;
  private static callbacks: Set<() => void> = new Set();

  // Batch animation updates using requestAnimationFrame
  static scheduleUpdate(callback: () => void) {
    this.callbacks.add(callback);
    
    if (!this.animationFrame) {
      this.animationFrame = requestAnimationFrame(() => {
        this.callbacks.forEach(cb => cb());
        this.callbacks.clear();
        this.animationFrame = null;
      });
    }
  }

  // Check if animations should be reduced
  static shouldReduceMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Get optimal animation duration based on user preferences
  static getOptimalDuration(baseDuration: number): number {
    return this.shouldReduceMotion() ? Math.min(baseDuration * 0.1, 50) : baseDuration;
  }

  // Check if element is in viewport for performance
  static isInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // Create optimized CSS transform
  static createTransform(transforms: Record<string, string | number>): string {
    const transformParts = [];
    
    // Order transforms for optimal performance
    const orderedKeys = ['translateX', 'translateY', 'translateZ', 'translate3d', 'scaleX', 'scaleY', 'scale', 'rotateX', 'rotateY', 'rotateZ', 'rotate'];
    
    orderedKeys.forEach(key => {
      if (transforms[key] !== undefined) {
        const value = transforms[key];
        transformParts.push(`${key}(${value})`);
      }
    });

    return transformParts.join(' ');
  }
}

// Hook for optimized CSS animations
export function useOptimizedAnimation(
  config: AnimationConfig & {
    trigger?: boolean;
    element?: React.RefObject<HTMLElement>;
  }
) {
  const { trigger = false, element, ...animationConfig } = config;
  const [state, setState] = useState<AnimationState>({
    isAnimating: false,
    progress: 0,
    direction: 'forward',
    iteration: 0,
  });

  useEffect(() => {
    if (!element?.current || !trigger) return;

    const el = element.current;
    const duration = AnimationOptimizer.getOptimalDuration(animationConfig.duration || 300);

    // Only animate if element is in viewport
    if (!AnimationOptimizer.isInViewport(el)) return;

    setState(prev => ({ ...prev, isAnimating: true }));

    const animation = el.animate(
      [
        { transform: 'translateX(0) scale(1)', opacity: 1 },
        { transform: 'translateX(100px) scale(1.1)', opacity: 0.8 },
      ],
      {
        duration,
        easing: animationConfig.easing || 'ease-out',
        delay: animationConfig.delay || 0,
        fill: animationConfig.fillMode || 'forwards',
        iterations: animationConfig.iterations || 1,
        direction: animationConfig.direction || 'normal',
      }
    );

    animation.addEventListener('finish', () => {
      setState(prev => ({ ...prev, isAnimating: false, progress: 1 }));
    });

    return () => {
      animation.cancel();
      setState(prev => ({ ...prev, isAnimating: false, progress: 0 }));
    };
  }, [trigger, element, animationConfig]);

  return state;
}

// Hook for spring-based animations
export function useSpringAnimation(
  from: number,
  to: number,
  config: SpringConfig = {}
) {
  const {
    tension = 170,
    friction = 26,
    mass = 1,
    velocity = 0,
    precision = 0.01,
  } = config;

  const [value, setValue] = useState(from);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const animationRef = useRef<{
    currentValue: number;
    currentVelocity: number;
    targetValue: number;
    startTime: number;
  }>({
    currentValue: from,
    currentVelocity: velocity,
    targetValue: to,
    startTime: 0,
  });

  const animate = useCallback(() => {
    const now = performance.now();
    const deltaTime = Math.min((now - animationRef.current.startTime) / 1000, 0.064);
    
    const { currentValue, currentVelocity, targetValue } = animationRef.current;
    
    // Spring physics calculation
    const displacement = currentValue - targetValue;
    const springForce = -tension * displacement;
    const dampingForce = -friction * currentVelocity;
    const acceleration = (springForce + dampingForce) / mass;
    
    const newVelocity = currentVelocity + acceleration * deltaTime;
    const newValue = currentValue + newVelocity * deltaTime;
    
    animationRef.current.currentValue = newValue;
    animationRef.current.currentVelocity = newVelocity;
    animationRef.current.startTime = now;
    
    setValue(newValue);
    
    // Check if animation should continue
    const isAtRest = Math.abs(newVelocity) < precision && Math.abs(displacement) < precision;
    
    if (!isAtRest) {
      AnimationOptimizer.scheduleUpdate(animate);
    } else {
      setIsAnimating(false);
      setValue(targetValue);
    }
  }, [tension, friction, mass, precision]);

  useEffect(() => {
    if (animationRef.current.targetValue !== to) {
      animationRef.current.targetValue = to;
      animationRef.current.startTime = performance.now();
      setIsAnimating(true);
      animate();
    }
  }, [to, animate]);

  return { value, isAnimating };
}

// Hook for intersection-based animations
export function useIntersectionAnimation(
  animationConfig: AnimationConfig = {},
  options: IntersectionObserverInit = {}
) {
  const elementRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [hasAnimated, options]);

  const animationStyle = useMemo<CSSProperties>(() => {
    if (AnimationOptimizer.shouldReduceMotion()) {
      return { opacity: isVisible ? 1 : 0 };
    }

    const duration = AnimationOptimizer.getOptimalDuration(animationConfig.duration || 600);
    
    return {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity ${duration}ms ${animationConfig.easing || 'ease-out'}, transform ${duration}ms ${animationConfig.easing || 'ease-out'}`,
      transitionDelay: `${animationConfig.delay || 0}ms`,
    };
  }, [isVisible, animationConfig]);

  return { elementRef, isVisible, hasAnimated, animationStyle };
}

// Hook for staggered animations
export function useStaggeredAnimation(
  items: unknown[],
  baseDelay: number = 100
) {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Stagger the animations
          items.forEach((_, index) => {
            setTimeout(() => {
              setVisibleItems(prev => new Set(prev).add(index));
            }, index * baseDelay);
          });
          
          observer.unobserve(container);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(container);

    return () => {
      observer.unobserve(container);
      observer.disconnect();
    };
  }, [items, baseDelay]);

  const getItemStyle = useCallback((index: number): CSSProperties => {
    const isVisible = visibleItems.has(index);
    
    if (AnimationOptimizer.shouldReduceMotion()) {
      return { opacity: isVisible ? 1 : 0 };
    }

    return {
      opacity: isVisible ? 1 : 0,
      transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.95)',
      transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
    };
  }, [visibleItems]);

  return { containerRef, getItemStyle, visibleItems };
}

// Hook for smooth value transitions
export function useSmoothTransition(
  value: number,
  duration: number = 300,
  easing: string = 'ease-out'
) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    if (displayValue === value) return;

    setIsTransitioning(true);
    
    const startValue = displayValue;
    const targetValue = value;
    const startTime = performance.now();
    const actualDuration = AnimationOptimizer.getOptimalDuration(duration);
    
    const animate = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / actualDuration, 1);
      
      // Easing function (ease-out)
      const easedProgress = easing === 'ease-out' 
        ? 1 - Math.pow(1 - progress, 3)
        : progress;
      
      const currentValue = startValue + (targetValue - startValue) * easedProgress;
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        AnimationOptimizer.scheduleUpdate(animate);
      } else {
        setDisplayValue(targetValue);
        setIsTransitioning(false);
      }
    };
    
    animate();
  }, [value, duration, easing, displayValue]);

  return { displayValue, isTransitioning };
}

// Hook for gesture-based animations (like drag, swipe)
export function useGestureAnimation() {
  const elementRef = useRef<HTMLElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [velocity, setVelocity] = useState({ x: 0, y: 0 });

  const startDrag = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    
    const startPos = { x: clientX, y: clientY };
    const startTime = performance.now();
    
    const handleMove = (moveX: number, moveY: number) => {
      const deltaX = moveX - startPos.x;
      const deltaY = moveY - startPos.y;
      const deltaTime = performance.now() - startTime;
      
      setPosition({ x: deltaX, y: deltaY });
      setVelocity({
        x: deltaX / deltaTime * 1000,
        y: deltaY / deltaTime * 1000,
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
      
      // Apply momentum with friction
      const friction = 0.95;
      let currentVel = { ...velocity };
      
      const momentumAnimation = () => {
        currentVel.x *= friction;
        currentVel.y *= friction;
        
        setPosition(prev => ({
          x: prev.x + currentVel.x * 0.016, // 60fps
          y: prev.y + currentVel.y * 0.016,
        }));
        
        if (Math.abs(currentVel.x) > 1 || Math.abs(currentVel.y) > 1) {
          AnimationOptimizer.scheduleUpdate(momentumAnimation);
        } else {
          // Snap back to origin
          setPosition({ x: 0, y: 0 });
        }
      };
      
      momentumAnimation();
    };

    // Mouse events
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleMouseUp = () => {
      handleEnd();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Touch events
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    };
    const handleTouchEnd = () => {
      handleEnd();
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [velocity]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  }, [startDrag]);

  const transformStyle = useMemo<CSSProperties>(() => ({
    transform: AnimationOptimizer.createTransform({
      translateX: `${position.x}px`,
      translateY: `${position.y}px`,
    }),
    transition: isDragging ? 'none' : 'transform 0.3s ease-out',
    cursor: isDragging ? 'grabbing' : 'grab',
  }), [position, isDragging]);

  return {
    elementRef,
    isDragging,
    position,
    velocity,
    transformStyle,
    handleMouseDown,
    handleTouchStart,
  };
}

// Animation performance monitoring
export class AnimationProfiler {
  private static measurements: Map<string, number[]> = new Map();

  static measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    
    const measurements = this.measurements.get(name)!;
    measurements.push(duration);
    
    // Keep only last 100 measurements
    if (measurements.length > 100) {
      measurements.shift();
    }

    return result;
  }

  static getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) return null;

    const sum = measurements.reduce((a, b) => a + b, 0);
    const avg = sum / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return { avg, min, max, count: measurements.length };
  }
}

// Utility functions
export const animationUtils = {
  // Create optimized keyframes
  createKeyframes: (keyframes: Record<string, CSSProperties>[]): Keyframe[] => {
    return keyframes.map(frame => {
      const optimizedFrame: Keyframe = {};
      
      Object.entries(frame).forEach(([property, value]) => {
        // Convert to transform when possible
        if (['x', 'y', 'scale', 'rotate'].includes(property)) {
          optimizedFrame.transform = AnimationOptimizer.createTransform({
            [property === 'x' ? 'translateX' : 
             property === 'y' ? 'translateY' : property]: value
          });
        } else {
          (optimizedFrame as CSSProperties)[property as keyof CSSProperties] = value;
        }
      });
      
      return optimizedFrame;
    });
  },

  // Check animation performance
  isHighPerformance: (): boolean => {
    // Check for hardware acceleration support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  },

  // Get optimal frame rate
  getOptimalFrameRate: (): number => {
    return AnimationOptimizer.shouldReduceMotion() ? 30 : 60;
  },
};

export default {
  AnimationOptimizer,
  useOptimizedAnimation,
  useSpringAnimation,
  useIntersectionAnimation,
  useStaggeredAnimation,
  useSmoothTransition,
  useGestureAnimation,
  AnimationProfiler,
  animationUtils,
};