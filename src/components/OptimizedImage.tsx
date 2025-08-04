"use client";

// Advanced Image Optimization & Lazy Loading - Phase 3 Week 9
import React, { 
  useState, 
  useRef, 
  useEffect, 
  useCallback,
  useMemo,
  CSSProperties,
  ImgHTMLAttributes
} from 'react';
import Image from 'next/image';
import { createOptimizedComponent } from '@/lib/react-performance-optimization';

interface OptimizedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading'> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty' | string;
  blurDataURL?: string;
  sizes?: string;
  fill?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  
  // Advanced lazy loading options
  lazy?: boolean;
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
  
  // Performance options
  progressive?: boolean;
  webp?: boolean;
  avif?: boolean;
  fallback?: string;
  
  // Animation options
  fadeIn?: boolean;
  slideIn?: 'top' | 'bottom' | 'left' | 'right';
  animationDuration?: number;
  
  // Error handling
  onError?: (error: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  
  // Custom loading component
  loadingComponent?: React.ComponentType<any>;
  errorComponent?: React.ComponentType<{ retry: () => void }>;
  
  // Container props
  containerClassName?: string;
  containerStyle?: CSSProperties;
}

interface ImageState {
  isIntersecting: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  hasError: boolean;
  retryCount: number;
}

// Advanced Intersection Observer hook
function useAdvancedIntersectionObserver(
  options: {
    threshold?: number;
    rootMargin?: string;
    once?: boolean;
    enabled?: boolean;
  } = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const { threshold = 0.1, rootMargin = '50px', once = true, enabled = true } = options;

  useEffect(() => {
    if (!enabled || hasIntersected) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const intersecting = entry.isIntersecting;
        setIsIntersecting(intersecting);
        
        if (intersecting && once) {
          setHasIntersected(true);
        }
      },
      { threshold, rootMargin }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, rootMargin, once, enabled, hasIntersected]);

  return { ref, isIntersecting: isIntersecting || hasIntersected };
}

// Progressive image enhancement
function useProgressiveImage(src: string, quality: number = 75) {
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;

    // Start with low quality placeholder
    const lowQualitySrc = `${src}?q=10&w=50`;
    setCurrentSrc(lowQualitySrc);

    // Preload high quality image
    const img = new window.Image();
    img.onload = () => {
      setCurrentSrc(`${src}?q=${quality}`);
      setIsLoaded(true);
    };
    img.src = `${src}?q=${quality}`;

    return () => {
      img.onload = null;
    };
  }, [src, quality]);

  return { currentSrc, isLoaded };
}

// Image format detection and optimization
function useOptimalImageFormat(src: string, options: { webp?: boolean; avif?: boolean } = {}) {
  const { webp = true, avif = true } = options;

  return useMemo(() => {
    if (typeof window === 'undefined') return src;

    // Check browser support
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    const supportsWebP = webp && canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    const supportsAVIF = avif && 'avif' in (new window.Image());

    // Return optimal format
    if (supportsAVIF) {
      return src.replace(/\.(jpg|jpeg|png)$/i, '.avif');
    }
    if (supportsWebP) {
      return src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }
    
    return src;
  }, [src, webp, avif]);
}

// Animation classes
const animations = {
  fadeIn: {
    initial: 'opacity-0',
    animate: 'opacity-100 transition-opacity duration-500 ease-in-out',
  },
  slideInTop: {
    initial: 'opacity-0 -translate-y-4',
    animate: 'opacity-100 translate-y-0 transition-all duration-500 ease-out',
  },
  slideInBottom: {
    initial: 'opacity-0 translate-y-4',
    animate: 'opacity-100 translate-y-0 transition-all duration-500 ease-out',
  },
  slideInLeft: {
    initial: 'opacity-0 -translate-x-4',
    animate: 'opacity-100 translate-x-0 transition-all duration-500 ease-out',
  },
  slideInRight: {
    initial: 'opacity-0 translate-x-4',
    animate: 'opacity-100 translate-x-0 transition-all duration-500 ease-out',
  },
};

// Main OptimizedImage component
const OptimizedImageBase: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  quality = 85,
  priority = false,
  placeholder = 'blur',
  blurDataURL,
  sizes,
  fill = false,
  objectFit = 'cover',
  objectPosition = 'center',
  
  // Lazy loading
  lazy = true,
  threshold = 0.1,
  rootMargin = '50px',
  once = true,
  
  // Performance
  progressive = true,
  webp = true,
  avif = true,
  fallback,
  
  // Animation
  fadeIn = true,
  slideIn,
  animationDuration = 500,
  
  // Events
  onError,
  onLoad,
  
  // Components
  loadingComponent: LoadingComponent,
  errorComponent: ErrorComponent,
  
  // Container
  containerClassName = '',
  containerStyle = {},
  
  // Rest props
  className = '',
  style = {},
  ...restProps
}) => {
  const [imageState, setImageState] = useState<ImageState>({
    isIntersecting: false,
    isLoaded: false,
    isLoading: false,
    hasError: false,
    retryCount: 0,
  });

  // Intersection observer for lazy loading
  const { ref, isIntersecting } = useAdvancedIntersectionObserver({
    threshold,
    rootMargin,
    once,
    enabled: lazy && !priority,
  });

  // Progressive loading
  const { currentSrc, isLoaded: progressiveLoaded } = useProgressiveImage(
    src,
    quality
  );

  // Optimal format
  const optimizedSrc = useOptimalImageFormat(src, { webp, avif });

  // Determine if image should load
  const shouldLoad = !lazy || priority || isIntersecting;

  // Handle image loading states
  const handleLoadStart = useCallback(() => {
    setImageState(prev => ({ ...prev, isLoading: true, hasError: false }));
  }, []);

  const handleLoadComplete = useCallback((event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageState(prev => ({ 
      ...prev, 
      isLoaded: true, 
      isLoading: false, 
      hasError: false 
    }));
    onLoad?.(event);
  }, [onLoad]);

  const handleError = useCallback((error: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageState(prev => ({ 
      ...prev, 
      hasError: true, 
      isLoading: false,
      retryCount: prev.retryCount + 1,
    }));
    onError?.(error);
  }, [onError]);

  const handleRetry = useCallback(() => {
    if (imageState.retryCount < 3) {
      setImageState(prev => ({ 
        ...prev, 
        hasError: false, 
        isLoading: false 
      }));
    }
  }, [imageState.retryCount]);

  // Animation classes
  const getAnimationClasses = () => {
    if (!imageState.isLoaded) {
      if (slideIn) {
        return animations[`slideIn${slideIn.charAt(0).toUpperCase() + slideIn.slice(1)}` as keyof typeof animations]?.initial || '';
      }
      if (fadeIn) {
        return animations.fadeIn.initial;
      }
    } else {
      if (slideIn) {
        return animations[`slideIn${slideIn.charAt(0).toUpperCase() + slideIn.slice(1)}` as keyof typeof animations]?.animate || '';
      }
      if (fadeIn) {
        return animations.fadeIn.animate;
      }
    }
    return '';
  };

  // Render loading component
  if (!shouldLoad) {
    return (
      <div 
        ref={ref}
        className={`${containerClassName} flex items-center justify-center bg-gray-100`}
        style={{ 
          width: width || '100%', 
          height: height || 200,
          ...containerStyle 
        }}
      >
        {LoadingComponent ? (
          <LoadingComponent />
        ) : (
          <div className="animate-pulse bg-gray-200 rounded-lg w-full h-full" />
        )}
      </div>
    );
  }

  // Render error component
  if (imageState.hasError && imageState.retryCount >= 3) {
    return (
      <div 
        className={`${containerClassName} flex items-center justify-center bg-red-50 border border-red-200 rounded-lg`}
        style={{ 
          width: width || '100%', 
          height: height || 200,
          ...containerStyle 
        }}
      >
        {ErrorComponent ? (
          <ErrorComponent retry={handleRetry} />
        ) : (
          <div className="text-center p-4">
            <div className="text-red-600 mb-2">Failed to load image</div>
            <button
              onClick={handleRetry}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  // Generate blur data URL if needed
  const generateBlurDataURL = (src: string): string => {
    if (blurDataURL) return blurDataURL;
    
    // Simple SVG placeholder
    const svg = `
      <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" fill="url(#grad)" />
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  };

  const finalSrc = progressive ? currentSrc : optimizedSrc;
  const animationClasses = getAnimationClasses();

  return (
    <div 
      ref={!shouldLoad ? ref : undefined}
      className={`${containerClassName} ${animationClasses}`}
      style={containerStyle}
    >
      <Image
        src={finalSrc || fallback || src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        quality={quality}
        priority={priority}
        sizes={sizes}
        placeholder={placeholder as any}
        blurDataURL={placeholder === 'blur' ? generateBlurDataURL(src) : undefined}
        className={`${className} ${animationClasses}`}
        style={{
          objectFit: fill ? objectFit : undefined,
          objectPosition: fill ? objectPosition : undefined,
          ...style,
        }}
        onLoadStart={handleLoadStart}
        onLoad={handleLoadComplete}
        onError={handleError}
        {...restProps}
      />
    </div>
  );
};

// Create optimized version with React.memo
export const OptimizedImage = createOptimizedComponent(OptimizedImageBase, {
  memoization: 'custom',
  customPropsEqual: (prevProps, nextProps) => {
    // Custom comparison logic for image props
    const importantProps = ['src', 'width', 'height', 'quality', 'alt'];
    return importantProps.every(prop => 
      (prevProps as any)[prop] === (nextProps as any)[prop]
    );
  },
  trackPerformance: true,
  componentName: 'OptimizedImage',
});

// Utility component for image galleries
export const ImageGallery: React.FC<{
  images: Array<{
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }>;
  columns?: number;
  gap?: number;
  lazy?: boolean;
}> = ({ images, columns = 3, gap = 16, lazy = true }) => {
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap: `${gap}px`,
  };

  return (
    <div style={gridStyle}>
      {images.map((image, index) => (
        <OptimizedImage
          key={`${image.src}-${index}`}
          src={image.src}
          alt={image.alt}
          width={image.width || 300}
          height={image.height || 200}
          lazy={lazy}
          fadeIn
          priority={index < 6} // Prioritize first 6 images
        />
      ))}
    </div>
  );
};

// Utility for responsive images
export const ResponsiveImage: React.FC<OptimizedImageProps & {
  breakpoints?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
}> = ({ breakpoints = { mobile: 400, tablet: 800, desktop: 1200 }, ...props }) => {
  const sizes = `
    (max-width: 768px) ${breakpoints.mobile}px,
    (max-width: 1024px) ${breakpoints.tablet}px,
    ${breakpoints.desktop}px
  `;

  return <OptimizedImage {...props} sizes={sizes} />;
};

export default OptimizedImage;