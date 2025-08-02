// Advanced Image Optimization and Lazy Loading - Phase 3 Week 9
import React, { 
  useState, 
  useRef, 
  useEffect, 
  useCallback, 
  useMemo,
  ImgHTMLAttributes 
} from 'react';

// Types for image optimization
interface ImageOptimizationOptions {
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  background?: string;
  blur?: number;
  sharpen?: boolean;
  grayscale?: boolean;
}

interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading' | 'onError'> {
  src: string;
  alt: string;
  placeholder?: string;
  fallback?: string;
  threshold?: number;
  rootMargin?: string;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  optimization?: ImageOptimizationOptions;
  eager?: boolean;
  priority?: boolean;
  blur?: boolean;
  fadeIn?: boolean;
  retryCount?: number;
  sizes?: string;
  srcSet?: string;
}

interface ImageState {
  isLoading: boolean;
  isLoaded: boolean;
  isError: boolean;
  isInView: boolean;
  error: Error | null;
  retryCount: number;
}

// Image format support detection
const detectImageSupport = (() => {
  let supportCache: Record<string, boolean> = {};

  const testSupport = (format: string): Promise<boolean> => {
    if (typeof window === 'undefined') return Promise.resolve(false);
    
    if (supportCache[format] !== undefined) {
      return Promise.resolve(supportCache[format]);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        supportCache[format] = img.width > 0 && img.height > 0;
        resolve(supportCache[format]);
      };
      img.onerror = () => {
        supportCache[format] = false;
        resolve(false);
      };

      // Test images for different formats
      const testImages = {
        webp: 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
        avif: 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=',
      };

      img.src = testImages[format as keyof typeof testImages] || '';
    });
  };

  return {
    webp: () => testSupport('webp'),
    avif: () => testSupport('avif'),
    getSupported: async (): Promise<string[]> => {
      const results = await Promise.all([
        testSupport('avif').then(supported => supported ? 'avif' : null),
        testSupport('webp').then(supported => supported ? 'webp' : null),
      ]);
      return results.filter(Boolean) as string[];
    }
  };
})();

// Image URL optimization utility
export const optimizeImageUrl = (
  src: string, 
  options: ImageOptimizationOptions = {}
): string => {
  if (!src) return '';

  const {
    quality = 85,
    format = 'auto',
    width,
    height,
    fit = 'cover',
    background = 'ffffff',
    blur,
    sharpen = false,
    grayscale = false,
  } = options;

  // If it's already a data URL or external URL, return as is
  if (src.startsWith('data:') || src.startsWith('http')) {
    return src;
  }

  // Build optimization parameters
  const params = new URLSearchParams();
  
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  if (quality !== 85) params.set('q', quality.toString());
  if (fit !== 'cover') params.set('fit', fit);
  if (format !== 'auto') params.set('f', format);
  if (background !== 'ffffff') params.set('bg', background);
  if (blur) params.set('blur', blur.toString());
  if (sharpen) params.set('sharpen', '1');
  if (grayscale) params.set('grayscale', '1');

  // Use Next.js image optimization API
  const optimizedUrl = `/_next/image?url=${encodeURIComponent(src)}&${params.toString()}`;
  
  return optimizedUrl;
};

// Generate responsive image srcSet
export const generateSrcSet = (
  src: string,
  sizes: number[],
  options?: ImageOptimizationOptions
): string => {
  return sizes
    .map(size => `${optimizeImageUrl(src, { ...options, width: size })} ${size}w`)
    .join(', ');
};

// Generate responsive image sizes attribute
export const generateSizes = (breakpoints: Array<{ breakpoint: string; size: string }>): string => {
  return breakpoints
    .map(({ breakpoint, size }) => `(${breakpoint}) ${size}`)
    .join(', ');
};

// Intersection Observer hook for lazy loading
const useIntersectionObserver = (
  threshold: number = 0.1,
  rootMargin: string = '50px'
) => {
  const [isInView, setIsInView] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(element);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [threshold, rootMargin]);

  return [elementRef, isInView] as const;
};

// Main LazyImage component
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  fallback,
  threshold = 0.1,
  rootMargin = '50px',
  onLoad,
  onError,
  optimization = {},
  eager = false,
  priority = false,
  blur = true,
  fadeIn = true,
  retryCount = 3,
  className = '',
  style,
  sizes,
  srcSet,
  ...props
}) => {
  const [state, setState] = useState<ImageState>({
    isLoading: false,
    isLoaded: false,
    isError: false,
    isInView: eager || priority,
    error: null,
    retryCount: 0,
  });

  const [elementRef, isInView] = useIntersectionObserver(threshold, rootMargin);
  const imgRef = useRef<HTMLImageElement>(null);

  // Update intersection state
  useEffect(() => {
    if (isInView && !state.isInView) {
      setState(prev => ({ ...prev, isInView: true }));
    }
  }, [isInView, state.isInView]);

  // Optimized image URLs
  const optimizedSrc = useMemo(() => 
    optimizeImageUrl(src, optimization),
    [src, optimization]
  );

  const optimizedSrcSet = useMemo(() => {
    if (srcSet) return srcSet;
    if (!optimization.width) return undefined;
    
    const sizes = [
      optimization.width,
      optimization.width * 1.5,
      optimization.width * 2,
    ].filter(Boolean) as number[];
    
    return generateSrcSet(src, sizes, optimization);
  }, [src, srcSet, optimization]);

  // Placeholder image
  const placeholderSrc = useMemo(() => {
    if (placeholder) return placeholder;
    if (!blur) return undefined;
    
    // Generate a tiny blurred version
    return optimizeImageUrl(src, {
      ...optimization,
      width: 20,
      height: 20,
      blur: 20,
      quality: 1,
    });
  }, [placeholder, blur, src, optimization]);

  // Load image
  const loadImage = useCallback(async () => {
    if (state.isLoading || state.isLoaded) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        
        if (optimizedSrcSet) img.srcset = optimizedSrcSet;
        if (sizes) img.sizes = sizes;
        img.src = optimizedSrc;
      });

      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        isLoaded: true 
      }));
      
      onLoad?.();
    } catch (error) {
      const err = error as Error;
      
      if (state.retryCount < retryCount) {
        // Retry after a delay
        setTimeout(() => {
          setState(prev => ({ 
            ...prev, 
            retryCount: prev.retryCount + 1,
            isLoading: false 
          }));
          loadImage();
        }, 1000 * Math.pow(2, state.retryCount));
      } else {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          isError: true, 
          error: err 
        }));
        onError?.(err);
      }
    }
  }, [optimizedSrc, optimizedSrcSet, sizes, state.isLoading, state.isLoaded, state.retryCount, retryCount, onLoad, onError]);

  // Start loading when in view
  useEffect(() => {
    if (state.isInView && !state.isLoaded && !state.isLoading) {
      loadImage();
    }
  }, [state.isInView, state.isLoaded, state.isLoading, loadImage]);

  // Render fallback if error
  if (state.isError && fallback) {
    return (
      <img
        ref={elementRef as React.RefObject<HTMLImageElement>}
        src={fallback}
        alt={alt}
        className={className}
        style={style}
        {...props}
      />
    );
  }

  // Render placeholder or loading state
  if (!state.isInView || (!state.isLoaded && placeholderSrc)) {
    return (
      <div
        ref={elementRef as React.RefObject<HTMLDivElement>}
        className={`relative overflow-hidden ${className}`}
        style={style}
      >
        {placeholderSrc && (
          <img
            src={placeholderSrc}
            alt=""
            className={`w-full h-full object-cover ${blur ? 'filter blur-sm' : ''}`}
            style={{ imageRendering: 'pixelated' }}
          />
        )}
        
        {state.isInView && state.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}

        {state.isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
    );
  }

  // Render loaded image
  return (
    <img
      ref={imgRef}
      src={optimizedSrc}
      srcSet={optimizedSrcSet}
      sizes={sizes}
      alt={alt}
      className={`${className} ${fadeIn && state.isLoaded ? 'transition-opacity duration-300 opacity-100' : fadeIn ? 'opacity-0' : ''}`}
      style={style}
      loading={eager || priority ? 'eager' : 'lazy'}
      decoding="async"
      {...props}
    />
  );
};

// Responsive image component
export const ResponsiveImage: React.FC<LazyImageProps & {
  breakpoints?: Array<{ breakpoint: string; width: number; height?: number }>;
}> = ({ breakpoints = [], ...props }) => {
  const responsiveSizes = useMemo(() => {
    if (!breakpoints.length) return undefined;
    
    return generateSizes(
      breakpoints.map(bp => ({
        breakpoint: bp.breakpoint,
        size: `${bp.width}px`,
      }))
    );
  }, [breakpoints]);

  const responsiveSrcSet = useMemo(() => {
    if (!breakpoints.length) return undefined;
    
    const sizes = breakpoints.map(bp => bp.width);
    return generateSrcSet(props.src, sizes, props.optimization);
  }, [breakpoints, props.src, props.optimization]);

  return (
    <LazyImage
      {...props}
      sizes={responsiveSizes || props.sizes}
      srcSet={responsiveSrcSet || props.srcSet}
    />
  );
};

// Image gallery component with lazy loading
export const ImageGallery: React.FC<{
  images: Array<{
    src: string;
    alt: string;
    caption?: string;
    thumbnail?: string;
  }>;
  columns?: number;
  gap?: number;
  onClick?: (index: number) => void;
}> = ({ images, columns = 3, gap = 16, onClick }) => {
  return (
    <div 
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {images.map((image, index) => (
        <div
          key={index}
          className="relative cursor-pointer hover:scale-105 transition-transform duration-200"
          onClick={() => onClick?.(index)}
        >
          <LazyImage
            src={image.thumbnail || image.src}
            alt={image.alt}
            className="w-full h-48 object-cover rounded-lg"
            optimization={{ width: 300, height: 192, quality: 80 }}
            blur
            fadeIn
          />
          {image.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 rounded-b-lg">
              <p className="text-sm truncate">{image.caption}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Hero image component with multiple sources
export const HeroImage: React.FC<LazyImageProps & {
  mobileSrc?: string;
  tabletSrc?: string;
}> = ({ mobileSrc, tabletSrc, ...props }) => {
  const srcSet = useMemo(() => {
    const sources = [];
    if (mobileSrc) sources.push(`${mobileSrc} 768w`);
    if (tabletSrc) sources.push(`${tabletSrc} 1024w`);
    sources.push(`${props.src} 1920w`);
    return sources.join(', ');
  }, [props.src, mobileSrc, tabletSrc]);

  const sizes = "(max-width: 768px) 100vw, (max-width: 1024px) 100vw, 1920px";

  return (
    <LazyImage
      {...props}
      srcSet={srcSet}
      sizes={sizes}
      priority
      className={`w-full h-auto ${props.className || ''}`}
      optimization={{ quality: 90, format: 'auto' }}
    />
  );
};

// Utility functions
export const imageUtils = {
  // Preload critical images
  preloadImages: (urls: string[]) => {
    return Promise.all(
      urls.map(url => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
      })
    );
  },

  // Get image dimensions
  getImageDimensions: (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    });
  },

  // Convert image to WebP if supported
  convertToWebP: async (src: string): Promise<string> => {
    const isSupported = await detectImageSupport.webp();
    if (isSupported && !src.includes('.webp')) {
      return optimizeImageUrl(src, { format: 'webp' });
    }
    return src;
  },

  // Generate placeholder
  generatePlaceholder: (src: string, blur: number = 20): string => {
    return optimizeImageUrl(src, {
      width: 20,
      height: 20,
      blur,
      quality: 1,
    });
  },
};

export default LazyImage;