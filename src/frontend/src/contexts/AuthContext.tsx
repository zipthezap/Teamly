import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { authAPI } from '../services/api';
import { PublicUser, UserLoginData, UserRegistrationData } from '../../../shared/types';

interface User extends PublicUser {
  [key: string]: unknown;
}

interface LoginResponse {
  requires2FA?: boolean;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  updateUser: (userData: Partial<User>) => void;
  login: (credentials: UserLoginData) => Promise<LoginResponse>;
  register: (userData: UserRegistrationData) => Promise<User>;
  logout: () => void;
  setTokens: (token: string, refreshToken: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (credentials: UserLoginData): Promise<LoginResponse> => {
    const response = await authAPI.login(credentials);
    
    // Check if 2FA is required
    if (response.data.requires2FA) {
      return { requires2FA: true };
    }
    
    const { user, accessToken } = response.data;
    
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    
    return { user };
  };

  const register = async (userData: UserRegistrationData): Promise<User> => {
    const response = await authAPI.register(userData);
    const { user, accessToken } = response.data;
    
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    
    return user;
  };

  const updateUser = (userData: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...userData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const setTokens = async (token: string, refreshToken: string) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    
    // Fetch user profile with the new token
    try {
      const response = await authAPI.getProfile();
      const userData = response.data.user;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, updateUser, login, register, logout, setTokens, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
