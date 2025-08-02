'use client'

import { createContext, useContext, ReactNode } from 'react';

// Development-only auth context
interface DevAuthContextType {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  isLoaded: boolean;
  isSignedIn: boolean;
}

const DevAuthContext = createContext<DevAuthContextType>({
  user: null,
  isLoaded: true,
  isSignedIn: false,
});

export const useDevAuth = () => useContext(DevAuthContext);

interface DevAuthProviderProps {
  children: ReactNode;
}

export function DevAuthProvider({ children }: DevAuthProviderProps) {
  // In development mode, simulate a signed-in user
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const authState: DevAuthContextType = {
    user: isDevelopment ? {
      id: 'dev-user-1',
      email: 'developer@adspro.com',
      firstName: 'Dev',
      lastName: 'User',
    } : null,
    isLoaded: true,
    isSignedIn: isDevelopment,
  };

  return (
    <DevAuthContext.Provider value={authState}>
      {children}
    </DevAuthContext.Provider>
  );
}