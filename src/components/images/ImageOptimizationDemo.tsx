'use client';

import React, { useState, useCallback } from 'react';
import { 
  LazyImage, 
  ResponsiveImage, 
  ImageGallery, 
  HeroImage,
  imageUtils 
} from '@/lib/image-optimization';
import { useRenderProfiler } from '@/lib/react-optimization';

// Sample image data
const sampleImages = {
  hero: '/images/hero-banner.jpg',
  campaigns: [
    { src: '/images/campaign-1.jpg', alt: 'Summer Sale Campaign', caption: 'Summer Sale 2024' },
    { src: '/images/campaign-2.jpg', alt: 'Brand Awareness', caption: 'Brand Awareness Q3' },
    { src: '/images/campaign-3.jpg', alt: 'Product Launch', caption: 'Product Launch Campaign' },
    { src: '/images/campaign-4.jpg', alt: 'Holiday Special', caption: 'Holiday Special Offer' },
    { src: '/images/campaign-5.jpg', alt: 'Back to School', caption: 'Back to School Campaign' },
    { src: '/images/campaign-6.jpg', alt: 'Black Friday', caption: 'Black Friday Deals' },
  ],
  profiles: [
    { src: '/images/user-1.jpg', alt: 'John Doe', caption: 'Marketing Manager' },
    { src: '/images/user-2.jpg', alt: 'Jane Smith', caption: 'Campaign Specialist' },
    { src: '/images/user-3.jpg', alt: 'Mike Johnson', caption: 'Analytics Expert' },
    { src: '/images/user-4.jpg', alt: 'Sarah Wilson', caption: 'Creative Director' },
  ],
};

// Generate placeholder images with different colors
const generatePlaceholderUrl = (width: number, height: number, color: string, text?: string) => {
  return `https://via.placeholder.com/${width}x${height}/${color}/ffffff?text=${encodeURIComponent(text || `${width}x${height}`)}`;
};

// Performance comparison component
const PerformanceComparison: React.FC = () => {
  const [showOptimized, setShowOptimized] = useState(true);
  const profileData = useRenderProfiler('PerformanceComparison');

  const images = Array.from({ length: 20 }, (_, i) => ({
    src: generatePlaceholderUrl(400, 300, ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FECA57'][i % 5], `Image ${i + 1}`),
    alt: `Performance test image ${i + 1}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Performance Comparison</h3>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={showOptimized}
              onChange={(e) => setShowOptimized(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Use Optimized Loading</span>
          </label>
          <div className="text-sm text-gray-500">
            Renders: {profileData.renderCount} | Avg: {profileData.averageRenderTime.toFixed(2)}ms
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((image, index) => (
          showOptimized ? (
            <LazyImage
              key={`optimized-${index}`}
              src={image.src}
              alt={image.alt}
              className="w-full h-32 object-cover rounded-lg"
              optimization={{ width: 200, height: 128, quality: 80 }}
              blur
              fadeIn
              threshold={0.1}
              rootMargin="100px"
            />
          ) : (
            <img
              key={`regular-${index}`}
              src={image.src}
              alt={image.alt}
              className="w-full h-32 object-cover rounded-lg"
              loading="lazy"
            />
          )
        ))}
      </div>
    </div>
  );
};

// Image formats demonstration
const ImageFormatsDemo: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState<'auto' | 'webp' | 'avif' | 'jpeg'>('auto');
  const [selectedQuality, setSelectedQuality] = useState(85);

  const testImage = generatePlaceholderUrl(800, 400, '6C5CE7', 'Format Test Image');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Format:</label>
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value as typeof selectedFormat)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
          >
            <option value="auto">Auto</option>
            <option value="webp">WebP</option>
            <option value="avif">AVIF</option>
            <option value="jpeg">JPEG</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Quality:</label>
          <input
            type="range"
            min="10"
            max="100"
            value={selectedQuality}
            onChange={(e) => setSelectedQuality(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-gray-500 w-8">{selectedQuality}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-2">Optimized Image</h4>
          <LazyImage
            src={testImage}
            alt="Format test image"
            className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            optimization={{
              width: 400,
              height: 200,
              quality: selectedQuality,
              format: selectedFormat,
            }}
            fadeIn
          />
        </div>

        <div>
          <h4 className="font-medium mb-2">Original Image</h4>
          <img
            src={testImage}
            alt="Original test image"
            className="w-full h-48 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
          />
        </div>
      </div>
    </div>
  );
};

// Responsive images demonstration
const ResponsiveImagesDemo: React.FC = () => {
  const responsiveBreakpoints = [
    { breakpoint: 'max-width: 640px', width: 320, height: 200 },
    { breakpoint: 'max-width: 768px', width: 640, height: 400 },
    { breakpoint: 'max-width: 1024px', width: 768, height: 480 },
    { breakpoint: 'min-width: 1025px', width: 1024, height: 640 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Responsive Images</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          These images automatically serve different sizes based on screen size and device pixel ratio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-2">Hero Image (Responsive)</h4>
          <HeroImage
            src={generatePlaceholderUrl(1920, 1080, 'A8E6CF', 'Desktop Hero')}
            mobileSrc={generatePlaceholderUrl(768, 432, 'FFD93D', 'Mobile Hero')}
            tabletSrc={generatePlaceholderUrl(1024, 576, '6BCF7F', 'Tablet Hero')}
            alt="Responsive hero image"
            className="w-full h-48 object-cover rounded-lg"
          />
        </div>

        <div>
          <h4 className="font-medium mb-2">Responsive Image with Breakpoints</h4>
          <ResponsiveImage
            src={generatePlaceholderUrl(1024, 640, '4D96FF', 'Responsive')}
            alt="Responsive image with breakpoints"
            className="w-full h-48 object-cover rounded-lg"
            breakpoints={responsiveBreakpoints}
            optimization={{ quality: 85 }}
            fadeIn
          />
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h5 className="font-medium mb-2">Breakpoint Configuration:</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {responsiveBreakpoints.map((bp, index) => (
            <div key={index} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{bp.breakpoint}:</span>
              <span className="font-mono">{bp.width}×{bp.height}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Image gallery demonstration
const GalleryDemo: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [columns, setColumns] = useState(3);

  const handleImageClick = useCallback((index: number) => {
    setSelectedImage(index);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Image Gallery</h3>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium">Columns:</label>
          <select
            value={columns}
            onChange={(e) => setColumns(Number(e.target.value))}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={6}>6</option>
          </select>
        </div>
      </div>

      <ImageGallery
        images={sampleImages.campaigns.map((img, i) => ({
          ...img,
          src: generatePlaceholderUrl(400, 300, ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FECA57', 'A8E6CF'][i], img.caption),
        }))}
        columns={columns}
        onClick={handleImageClick}
      />

      {selectedImage !== null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 text-xl"
            >
              ✕ Close
            </button>
            <LazyImage
              src={generatePlaceholderUrl(800, 600, '6C5CE7', sampleImages.campaigns[selectedImage].caption)}
              alt={sampleImages.campaigns[selectedImage].alt}
              className="max-w-full max-h-full object-contain rounded-lg"
              optimization={{ width: 800, height: 600, quality: 90 }}
              priority
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-4 rounded-b-lg">
              <h4 className="font-semibold">{sampleImages.campaigns[selectedImage].caption}</h4>
              <p className="text-sm opacity-90">{sampleImages.campaigns[selectedImage].alt}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main demo component
export default function ImageOptimizationDemo() {
  const [activeSection, setActiveSection] = useState('performance');

  const sections = [
    { id: 'performance', label: 'Performance Comparison', component: PerformanceComparison },
    { id: 'formats', label: 'Image Formats', component: ImageFormatsDemo },
    { id: 'responsive', label: 'Responsive Images', component: ResponsiveImagesDemo },
    { id: 'gallery', label: 'Image Gallery', component: GalleryDemo },
  ];

  const ActiveSection = sections.find(s => s.id === activeSection)?.component;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Image Optimization & Lazy Loading Demo
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Comprehensive image optimization with lazy loading, format conversion, and responsive sizing
        </p>
      </div>

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">Lazy Loading</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">Load images when they enter viewport</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-green-900 dark:text-green-100">Format Optimization</h3>
          <p className="text-sm text-green-700 dark:text-green-300">Automatic WebP/AVIF conversion</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-purple-900 dark:text-purple-100">Responsive Images</h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">Serve optimal sizes for devices</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
          <h3 className="font-semibold text-orange-900 dark:text-orange-100">Smart Caching</h3>
          <p className="text-sm text-orange-700 dark:text-orange-300">Efficient browser caching</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeSection === section.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Active Section */}
      <div className="min-h-[500px]">
        {ActiveSection && <ActiveSection />}
      </div>

      {/* Best Practices */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
          🎯 Image Optimization Best Practices
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Performance</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Use lazy loading for images below the fold</li>
              <li>• Implement proper sizing with srcSet and sizes</li>
              <li>• Choose optimal quality settings (80-85 for photos)</li>
              <li>• Use modern formats (WebP/AVIF) with fallbacks</li>
              <li>• Implement progressive JPEG for large images</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">User Experience</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Show placeholder or skeleton while loading</li>
              <li>• Use blur-up technique for smooth transitions</li>
              <li>• Preload critical above-the-fold images</li>
              <li>• Implement proper error handling and fallbacks</li>
              <li>• Consider dark mode optimized images</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}