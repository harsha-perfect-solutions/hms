import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { managementApiService, ManagementUser } from '../services/api';

interface ManagementAuthContextType {
  user: ManagementUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  getCurrentUser: () => ManagementUser | null;
}

const ManagementAuthContext = createContext<ManagementAuthContextType | undefined>(undefined);

export const ManagementAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ManagementUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Verify management session on mount
  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        const authUser = await managementApiService.getMe();
        if (isMounted) {
          setUser(authUser);
        }
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    try {
      const response = await managementApiService.login(identifier, password);
      if (response.success && response.user) {
        setUser(response.user);
        return { success: true };
      }
      return { success: false, message: response.message || 'Login failed.' };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Unable to sign in right now. Please try again.',
      };
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await managementApiService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCurrentUser = useCallback(() => user, [user]);

  const value: ManagementAuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    getCurrentUser,
  };

  return <ManagementAuthContext.Provider value={value}>{children}</ManagementAuthContext.Provider>;
};

export const useManagementAuth = (): ManagementAuthContextType => {
  const context = useContext(ManagementAuthContext);
  if (!context) {
    throw new Error('useManagementAuth must be used within a ManagementAuthProvider');
  }
  return context;
};
