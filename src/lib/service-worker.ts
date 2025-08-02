// Service Worker Registration and Management - Phase 3 Week 8

interface ServiceWorkerOptions {
  swPath?: string;
  scope?: string;
  enablePush?: boolean;
  enableBackgroundSync?: boolean;
  updateCheckInterval?: number;
}

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isInstalling: boolean;
  isWaiting: boolean;
  isActive: boolean;
  registration: ServiceWorkerRegistration | null;
}

class ServiceWorkerManager {
  private options: ServiceWorkerOptions;
  private state: ServiceWorkerState;
  private updateCheckTimer?: NodeJS.Timeout;
  private listeners: Map<string, Function[]> = new Map();

  constructor(options: ServiceWorkerOptions = {}) {
    this.options = {
      swPath: '/sw.js',
      scope: '/',
      enablePush: false,
      enableBackgroundSync: true,
      updateCheckInterval: 60000, // 1 minute
      ...options,
    };

    this.state = {
      isSupported: this.checkSupport(),
      isRegistered: false,
      isInstalling: false,
      isWaiting: false,
      isActive: false,
      registration: null,
    };
  }

  private checkSupport(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  // Register service worker
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.state.isSupported) {
      console.warn('Service Workers are not supported in this browser');
      return null;
    }

    try {
      console.log('Registering Service Worker...');
      
      const registration = await navigator.serviceWorker.register(
        this.options.swPath!,
        { scope: this.options.scope }
      );

      this.state.registration = registration;
      this.state.isRegistered = true;

      // Set up event listeners
      this.setupEventListeners(registration);

      // Check for updates periodically
      if (this.options.updateCheckInterval) {
        this.startUpdateCheck();
      }

      // Enable push notifications if requested
      if (this.options.enablePush) {
        await this.enablePushNotifications(registration);
      }

      // Enable background sync if requested
      if (this.options.enableBackgroundSync) {
        await this.enableBackgroundSync(registration);
      }

      console.log('Service Worker registered successfully');
      this.emit('registered', registration);

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      this.emit('error', error);
      return null;
    }
  }

  // Setup event listeners for service worker lifecycle
  private setupEventListeners(registration: ServiceWorkerRegistration): void {
    // Listen for installing state
    if (registration.installing) {
      this.state.isInstalling = true;
      this.trackWorkerState(registration.installing, 'installing');
    }

    // Listen for waiting state
    if (registration.waiting) {
      this.state.isWaiting = true;
      this.emit('waiting', registration.waiting);
    }

    // Listen for active state
    if (registration.active) {
      this.state.isActive = true;
      this.emit('active', registration.active);
    }

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      console.log('Service Worker update found');
      const newWorker = registration.installing;
      
      if (newWorker) {
        this.state.isInstalling = true;
        this.trackWorkerState(newWorker, 'updatefound');
      }
    });

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed');
      this.emit('controllerchange');
      
      // Reload the page to use the new service worker
      if (this.state.isActive) {
        window.location.reload();
      }
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });
  }

  // Track service worker state changes
  private trackWorkerState(worker: ServiceWorker, context: string): void {
    worker.addEventListener('statechange', () => {
      console.log(`Service Worker (${context}) state changed:`, worker.state);
      
      switch (worker.state) {
        case 'installed':
          this.state.isInstalling = false;
          if (navigator.serviceWorker.controller) {
            // New worker installed, show update notification
            this.state.isWaiting = true;
            this.emit('waiting', worker);
          } else {
            // First install
            this.emit('installed', worker);
          }
          break;
          
        case 'activated':
          this.state.isWaiting = false;
          this.state.isActive = true;
          this.emit('activated', worker);
          break;
          
        case 'redundant':
          this.emit('redundant', worker);
          break;
      }
    });
  }

  // Handle messages from service worker
  private handleMessage(data: unknown): void {
    if (typeof data === 'object' && data !== null) {
      const message = data as { type: string; payload?: unknown };
      
      switch (message.type) {
        case 'CACHE_UPDATED':
          this.emit('cacheUpdated', message.payload);
          break;
          
        case 'OFFLINE':
          this.emit('offline');
          break;
          
        case 'ONLINE':
          this.emit('online');
          break;
          
        default:
          this.emit('message', message);
      }
    }
  }

  // Enable push notifications
  private async enablePushNotifications(registration: ServiceWorkerRegistration): Promise<void> {
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
        
        console.log('Push notifications enabled');
        this.emit('pushEnabled', subscription);
        
        // Send subscription to your server
        await this.sendSubscriptionToServer(subscription);
      } else {
        console.warn('Push notification permission denied');
      }
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
    }
  }

  // Enable background sync
  private async enableBackgroundSync(registration: ServiceWorkerRegistration): Promise<void> {
    try {
      if ('sync' in registration) {
        await (registration as any).sync.register('background-sync');
        console.log('Background sync enabled');
        this.emit('backgroundSyncEnabled');
      }
    } catch (error) {
      console.error('Failed to enable background sync:', error);
    }
  }

  // Send push subscription to server
  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  // Start periodic update checks
  private startUpdateCheck(): void {
    this.updateCheckTimer = setInterval(async () => {
      if (this.state.registration) {
        await this.state.registration.update();
      }
    }, this.options.updateCheckInterval);
  }

  // Stop update checks
  private stopUpdateCheck(): void {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = undefined;
    }
  }

  // Skip waiting and activate new service worker
  async skipWaiting(): Promise<void> {
    if (this.state.registration?.waiting) {
      this.state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  // Send message to service worker
  sendMessage(message: unknown): void {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
  }

  // Invalidate cache for specific pattern
  invalidateCache(pattern: string): void {
    this.sendMessage({
      type: 'CACHE_INVALIDATE',
      pattern,
    });
  }

  // Unregister service worker
  async unregister(): Promise<boolean> {
    if (this.state.registration) {
      this.stopUpdateCheck();
      const result = await this.state.registration.unregister();
      
      if (result) {
        this.state.isRegistered = false;
        this.state.registration = null;
        this.emit('unregistered');
      }
      
      return result;
    }
    
    return false;
  }

  // Event listener management
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Get current state
  getState(): ServiceWorkerState {
    return { ...this.state };
  }

  // Check if online
  isOnline(): boolean {
    return navigator.onLine;
  }

  // Get cache usage (if supported)
  async getCacheUsage(): Promise<{ quota: number; usage: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
      };
    }
    return null;
  }
}

// Singleton instance
let serviceWorkerManager: ServiceWorkerManager | null = null;

export function getServiceWorkerManager(options?: ServiceWorkerOptions): ServiceWorkerManager {
  if (!serviceWorkerManager) {
    serviceWorkerManager = new ServiceWorkerManager(options);
  }
  return serviceWorkerManager;
}

// React hook for service worker state
export function useServiceWorker(options?: ServiceWorkerOptions) {
  const [state, setState] = React.useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isInstalling: false,
    isWaiting: false,
    isActive: false,
    registration: null,
  });
  
  const [manager] = React.useState(() => getServiceWorkerManager(options));

  React.useEffect(() => {
    // Initialize state
    setState(manager.getState());

    // Set up event listeners
    const updateState = () => setState(manager.getState());
    
    manager.on('registered', updateState);
    manager.on('waiting', updateState);
    manager.on('activated', updateState);
    manager.on('unregistered', updateState);

    // Register service worker
    manager.register();

    return () => {
      manager.off('registered', updateState);
      manager.off('waiting', updateState);
      manager.off('activated', updateState);
      manager.off('unregistered', updateState);
    };
  }, [manager]);

  return {
    ...state,
    skipWaiting: () => manager.skipWaiting(),
    invalidateCache: (pattern: string) => manager.invalidateCache(pattern),
    sendMessage: (message: unknown) => manager.sendMessage(message),
    isOnline: manager.isOnline(),
  };
}

// Utility functions
export const serviceWorkerUtils = {
  // Check if service worker is supported
  isSupported: () => {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    );
  },

  // Register service worker with default options
  register: (options?: ServiceWorkerOptions) => {
    return getServiceWorkerManager(options).register();
  },

  // Unregister all service workers
  unregisterAll: async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
  },
};

// React component imports (need to be imported separately)
let React: typeof import('react');
if (typeof window !== 'undefined') {
  React = require('react');
}

export { ServiceWorkerManager };
export default getServiceWorkerManager;