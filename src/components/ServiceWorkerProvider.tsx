'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getServiceWorkerManager, ServiceWorkerManager } from '@/lib/service-worker';

interface ServiceWorkerContextType {
  manager: ServiceWorkerManager | null;
  isSupported: boolean;
  isRegistered: boolean;
  isInstalling: boolean;
  isWaiting: boolean;
  isActive: boolean;
  isOnline: boolean;
  skipWaiting: () => void;
  invalidateCache: (pattern: string) => void;
  showUpdateNotification: boolean;
  dismissUpdateNotification: () => void;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType | null>(null);

interface ServiceWorkerProviderProps {
  children: React.ReactNode;
  options?: {
    swPath?: string;
    scope?: string;
    enablePush?: boolean;
    enableBackgroundSync?: boolean;
    updateCheckInterval?: number;
  };
}

export function ServiceWorkerProvider({ children, options }: ServiceWorkerProviderProps) {
  const [manager, setManager] = useState<ServiceWorkerManager | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  useEffect(() => {
    // Initialize service worker manager
    const swManager = getServiceWorkerManager(options);
    setManager(swManager);
    
    // Set initial state
    const state = swManager.getState();
    setIsSupported(state.isSupported);
    setIsRegistered(state.isRegistered);
    setIsInstalling(state.isInstalling);
    setIsWaiting(state.isWaiting);
    setIsActive(state.isActive);
    setIsOnline(swManager.isOnline());

    // Set up event listeners
    const handleRegistered = () => {
      setIsRegistered(true);
      console.log('Service Worker registered successfully');
    };

    const handleWaiting = () => {
      setIsWaiting(true);
      setShowUpdateNotification(true);
      console.log('Service Worker update available');
    };

    const handleActivated = () => {
      setIsActive(true);
      setIsWaiting(false);
      setShowUpdateNotification(false);
      console.log('Service Worker activated');
    };

    const handleInstalling = () => {
      setIsInstalling(true);
      console.log('Service Worker installing...');
    };

    const handleInstalled = () => {
      setIsInstalling(false);
      console.log('Service Worker installed');
    };

    const handleControllerChange = () => {
      console.log('Service Worker controller changed');
      // The page will reload automatically
    };

    const handleError = (error: Error) => {
      console.error('Service Worker error:', error);
      // You might want to show an error notification here
    };

    const handleOnline = () => {
      setIsOnline(true);
      console.log('App is online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('App is offline');
    };

    // Register event listeners
    swManager.on('registered', handleRegistered);
    swManager.on('waiting', handleWaiting);
    swManager.on('activated', handleActivated);
    swManager.on('installing', handleInstalling);
    swManager.on('installed', handleInstalled);
    swManager.on('controllerchange', handleControllerChange);
    swManager.on('error', handleError);
    swManager.on('online', handleOnline);
    swManager.on('offline', handleOffline);

    // Listen for browser online/offline events
    const handleBrowserOnline = () => setIsOnline(true);
    const handleBrowserOffline = () => setIsOnline(false);

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    // Register service worker if supported
    if (state.isSupported) {
      swManager.register().catch(console.error);
    }

    // Cleanup
    return () => {
      swManager.off('registered', handleRegistered);
      swManager.off('waiting', handleWaiting);
      swManager.off('activated', handleActivated);
      swManager.off('installing', handleInstalling);
      swManager.off('installed', handleInstalled);
      swManager.off('controllerchange', handleControllerChange);
      swManager.off('error', handleError);
      swManager.off('online', handleOnline);
      swManager.off('offline', handleOffline);

      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
    };
  }, [options]);

  const skipWaiting = () => {
    if (manager) {
      manager.skipWaiting();
    }
  };

  const invalidateCache = (pattern: string) => {
    if (manager) {
      manager.invalidateCache(pattern);
    }
  };

  const dismissUpdateNotification = () => {
    setShowUpdateNotification(false);
  };

  const contextValue: ServiceWorkerContextType = {
    manager,
    isSupported,
    isRegistered,
    isInstalling,
    isWaiting,
    isActive,
    isOnline,
    skipWaiting,
    invalidateCache,
    showUpdateNotification,
    dismissUpdateNotification,
  };

  return (
    <ServiceWorkerContext.Provider value={contextValue}>
      {children}
      
      {/* Update notification */}
      {showUpdateNotification && (
        <UpdateNotification
          onUpdate={skipWaiting}
          onDismiss={dismissUpdateNotification}
        />
      )}
      
      {/* Offline indicator */}
      {!isOnline && <OfflineIndicator />}
    </ServiceWorkerContext.Provider>
  );
}

// Update notification component
function UpdateNotification({ onUpdate, onDismiss }: {
  onUpdate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm">Update Available</h4>
          <p className="text-xs mt-1 opacity-90">
            A new version of the app is available. Refresh to get the latest features.
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="text-white/70 hover:text-white"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={onUpdate}
          className="bg-white text-blue-600 px-3 py-1 rounded text-xs font-medium hover:bg-blue-50"
        >
          Update Now
        </button>
        <button
          onClick={onDismiss}
          className="text-white/70 hover:text-white px-3 py-1 text-xs"
        >
          Later
        </button>
      </div>
    </div>
  );
}

// Offline indicator component
function OfflineIndicator() {
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      <div className="flex items-center gap-2 text-sm">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        You're offline - some features may be limited
      </div>
    </div>
  );
}

// Hook to use service worker context
export function useServiceWorkerContext() {
  const context = useContext(ServiceWorkerContext);
  
  if (!context) {
    throw new Error('useServiceWorkerContext must be used within a ServiceWorkerProvider');
  }
  
  return context;
}

// Hook for cache invalidation
export function useCacheInvalidation() {
  const { invalidateCache } = useServiceWorkerContext();
  
  return {
    invalidateCampaigns: (organizationId?: string) => {
      invalidateCache(organizationId ? `campaigns/${organizationId}` : 'campaigns');
    },
    invalidateAnalytics: (campaignId?: string) => {
      invalidateCache(campaignId ? `analytics/${campaignId}` : 'analytics');
    },
    invalidateAll: () => {
      invalidateCache('');
    },
  };
}

export default ServiceWorkerProvider;