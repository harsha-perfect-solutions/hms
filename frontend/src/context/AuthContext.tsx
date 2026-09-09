import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiService, StudentUser } from '../services/api';

interface AuthContextType {
  user: StudentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (jntuNo: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  getCurrentUser: () => StudentUser | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StudentUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check active session on initial mount
  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      try {
        const student = await apiService.getMe();
        if (isMounted) {
          setUser(student);
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

  const login = useCallback(async (jntuNo: string, password: string) => {
    try {
      const response = await apiService.login(jntuNo, password);
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
      await apiService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCurrentUser = useCallback(() => user, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    getCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
