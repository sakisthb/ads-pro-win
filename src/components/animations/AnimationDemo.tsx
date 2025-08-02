'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  useOptimizedAnimation,
  useSpringAnimation,
  useIntersectionAnimation,
  useStaggeredAnimation,
  useSmoothTransition,
  useGestureAnimation,
  AnimationProfiler,
  AnimationOptimizer,
} from '@/lib/animation-optimization';
import { useRenderProfiler } from '@/lib/react-optimization';

// Spring animation demo
const SpringDemo: React.FC = () => {
  const [target, setTarget] = useState(0);
  const { value, isAnimating } = useSpringAnimation(value, target, {
    tension: 170,
    friction: 26,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setTarget(target === 0 ? 100 : 0)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Toggle Spring ({target === 0 ? '100' : '0'})
        </button>
        <span className="text-sm text-gray-500">
          Value: {value.toFixed(2)} | Animating: {isAnimating ? 'Yes' : 'No'}
        </span>
      </div>
      
      <div className="relative h-20 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <div
          className="absolute top-1/2 w-8 h-8 bg-blue-600 rounded-full transform -translate-y-1/2 transition-shadow"
          style={{
            left: `calc(${value}% - 16px)`,
            boxShadow: isAnimating ? '0 0 20px rgba(59, 130, 246, 0.5)' : 'none',
          }}
        />
      </div>
    </div>
  );
};

// Intersection animation demo
const IntersectionDemo: React.FC = () => {
  const { elementRef, isVisible, animationStyle } = useIntersectionAnimation({
    duration: 800,
    easing: 'ease-out',
    delay: 100,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Scroll this element into view to see the animation:
      </p>
      
      <div
        ref={elementRef as React.RefObject<HTMLDivElement>}
        className="p-6 bg-gradient-to-r from-purple-400 to-pink-600 text-white rounded-lg"
        style={animationStyle}
      >
        <h3 className="text-lg font-semibold mb-2">Intersection Animation</h3>
        <p className="text-sm opacity-90">
          This element animates when it enters the viewport. Status: {isVisible ? 'Visible' : 'Hidden'}
        </p>
      </div>
    </div>
  );
};

// Staggered animation demo
const StaggeredDemo: React.FC = () => {
  const items = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    title: `Item ${i + 1}`,
    color: ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-gray-500'][i],
  }));

  const { containerRef, getItemStyle } = useStaggeredAnimation(items, 150);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Scroll to see staggered animations:
      </p>
      
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`p-4 ${item.color} text-white rounded-lg`}
            style={getItemStyle(index)}
          >
            <h4 className="font-semibold">{item.title}</h4>
            <p className="text-sm opacity-90">Delay: {index * 150}ms</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Smooth transition demo
const SmoothTransitionDemo: React.FC = () => {
  const [targetValue, setTargetValue] = useState(50);
  const { displayValue, isTransitioning } = useSmoothTransition(targetValue, 600, 'ease-out');

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <label className="text-sm font-medium">Target Value:</label>
        <input
          type="range"
          min="0"
          max="100"
          value={targetValue}
          onChange={(e) => setTargetValue(Number(e.target.value))}
          className="flex-1 max-w-xs"
        />
        <span className="text-sm text-gray-500 w-16">{targetValue}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Display Value: {displayValue.toFixed(1)}</span>
          <span className={`${isTransitioning ? 'text-blue-600' : 'text-green-600'}`}>
            {isTransitioning ? 'Transitioning...' : 'Complete'}
          </span>
        </div>
        
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
            style={{ width: `${displayValue}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// Gesture animation demo
const GestureDemo: React.FC = () => {
  const {
    elementRef,
    isDragging,
    position,
    velocity,
    transformStyle,
    handleMouseDown,
    handleTouchStart,
  } = useGestureAnimation();

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Drag the element below (mouse or touch):
      </p>
      
      <div className="relative h-32 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <div
          ref={elementRef as React.RefObject<HTMLDivElement>}
          className={`absolute top-1/2 left-1/2 w-16 h-16 bg-gradient-to-r from-orange-400 to-red-600 rounded-lg transform -translate-x-1/2 -translate-y-1/2 ${
            isDragging ? 'shadow-lg scale-110' : 'shadow-md'
          }`}
          style={transformStyle}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="flex items-center justify-center h-full text-white font-bold">
            Drag
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Position:</span>
          <span className="ml-2 font-mono">
            x: {position.x.toFixed(0)}, y: {position.y.toFixed(0)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Velocity:</span>
          <span className="ml-2 font-mono">
            x: {velocity.x.toFixed(0)}, y: {velocity.y.toFixed(0)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Performance comparison demo
const PerformanceDemo: React.FC = () => {
  const [animationType, setAnimationType] = useState<'optimized' | 'standard'>('optimized');
  const [isAnimating, setIsAnimating] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const profileData = useRenderProfiler('PerformanceDemo');

  const startAnimation = useCallback(() => {
    if (!elementRef.current) return;
    
    setIsAnimating(true);
    
    if (animationType === 'optimized') {
      // Use optimized transform animations
      AnimationProfiler.measure('optimized-animation', () => {
        elementRef.current!.style.transform = 'translateX(200px) scale(1.2) rotate(360deg)';
        elementRef.current!.style.transition = 'transform 1s ease-out';
      });
    } else {
      // Use less optimal properties
      AnimationProfiler.measure('standard-animation', () => {
        elementRef.current!.style.left = '200px';
        elementRef.current!.style.width = '120%';
        elementRef.current!.style.transition = 'left 1s ease-out, width 1s ease-out';
      });
    }
    
    setTimeout(() => {
      setIsAnimating(false);
      if (elementRef.current) {
        elementRef.current.style.transform = '';
        elementRef.current.style.left = '';
        elementRef.current.style.width = '';
        elementRef.current.style.transition = '';
      }
    }, 1000);
  }, [animationType]);

  const optimizedStats = AnimationProfiler.getStats('optimized-animation');
  const standardStats = AnimationProfiler.getStats('standard-animation');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium">Animation Type:</label>
          <select
            value={animationType}
            onChange={(e) => setAnimationType(e.target.value as typeof animationType)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
          >
            <option value="optimized">Optimized (Transform)</option>
            <option value="standard">Standard (Layout)</option>
          </select>
        </div>
        
        <button
          onClick={startAnimation}
          disabled={isAnimating}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isAnimating ? 'Animating...' : 'Start Animation'}
        </button>
      </div>
      
      <div className="relative h-32 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <div
          ref={elementRef}
          className="absolute top-1/2 w-16 h-16 bg-gradient-to-r from-green-400 to-blue-600 rounded-lg transform -translate-y-1/2"
        >
          <div className="flex items-center justify-center h-full text-white font-bold text-xs">
            {animationType === 'optimized' ? 'GPU' : 'CPU'}
          </div>
        </div>
      </div>
      
      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-green-900 dark:text-green-100">Optimized Stats</h4>
          {optimizedStats ? (
            <div className="space-y-1 text-green-700 dark:text-green-300">
              <div>Avg: {optimizedStats.avg.toFixed(2)}ms</div>
              <div>Count: {optimizedStats.count}</div>
            </div>
          ) : (
            <div className="text-green-600 dark:text-green-400">No data yet</div>
          )}
        </div>
        
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-orange-900 dark:text-orange-100">Standard Stats</h4>
          {standardStats ? (
            <div className="space-y-1 text-orange-700 dark:text-orange-300">
              <div>Avg: {standardStats.avg.toFixed(2)}ms</div>
              <div>Count: {standardStats.count}</div>
            </div>
          ) : (
            <div className="text-orange-600 dark:text-orange-400">No data yet</div>
          )}
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 dark:text-blue-100">Render Stats</h4>
          <div className="space-y-1 text-blue-700 dark:text-blue-300">
            <div>Renders: {profileData.renderCount}</div>
            <div>Avg: {profileData.averageRenderTime.toFixed(2)}ms</div>
            <div>Slow: {profileData.slowRenders}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main demo component
export default function AnimationDemo() {
  const [activeDemo, setActiveDemo] = useState('spring');
  const [reducedMotion, setReducedMotion] = useState(false);

  // Simulate reduced motion preference
  useEffect(() => {
    if (reducedMotion) {
      document.documentElement.style.setProperty('--animation-duration', '0.1s');
    } else {
      document.documentElement.style.removeProperty('--animation-duration');
    }
  }, [reducedMotion]);

  const demos = [
    { id: 'spring', label: 'Spring Animation', component: SpringDemo },
    { id: 'intersection', label: 'Intersection Observer', component: IntersectionDemo },
    { id: 'staggered', label: 'Staggered Animations', component: StaggeredDemo },
    { id: 'smooth', label: 'Smooth Transitions', component: SmoothTransitionDemo },
    { id: 'gesture', label: 'Gesture Animations', component: GestureDemo },
    { id: 'performance', label: 'Performance Comparison', component: PerformanceDemo },
  ];

  const ActiveDemo = demos.find(demo => demo.id === activeDemo)?.component;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Animation Performance Optimization
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            High-performance animations with GPU acceleration and accessibility support
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="rounded"
            />
            <span>Reduced Motion</span>
          </label>
        </div>
      </div>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">GPU Acceleration</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">Hardware-accelerated transforms</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-900 dark:text-green-100">Accessibility</h3>
          <p className="text-sm text-green-700 dark:text-green-300">Respects reduced motion preferences</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-900 dark:text-purple-100">Performance</h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">60fps smooth animations</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
          <h3 className="font-semibold text-orange-900 dark:text-orange-100">Batched Updates</h3>
          <p className="text-sm text-orange-700 dark:text-orange-300">Optimized RAF scheduling</p>
        </div>
      </div>

      {/* Demo Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {demos.map((demo) => (
            <button
              key={demo.id}
              onClick={() => setActiveDemo(demo.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeDemo === demo.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {demo.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Demo */}
      <div className="min-h-[400px]">
        {ActiveDemo && <ActiveDemo />}
      </div>

      {/* Performance Tips */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
          🚀 Animation Performance Best Practices
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Hardware Acceleration</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Use transform instead of changing position properties</li>
              <li>• Prefer opacity changes over display/visibility</li>
              <li>• Use will-change hint sparingly</li>
              <li>• Promote elements to composite layers with transform3d(0,0,0)</li>
              <li>• Avoid animating layout-triggering properties</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Performance Optimization</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Batch DOM updates with requestAnimationFrame</li>
              <li>• Use intersection observers for scroll-based animations</li>
              <li>• Implement proper cleanup for animation listeners</li>
              <li>• Respect prefers-reduced-motion media query</li>
              <li>• Profile animation performance in DevTools</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}