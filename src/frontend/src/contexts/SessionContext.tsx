import React, { createContext, useContext, ReactNode } from 'react';
import { SessionWithDetails } from '../../../shared/types';

interface SessionContextType {
  event: SessionWithDetails | null;
  loading: boolean;
  error: string;
  success: string;
  fetchEvent: () => Promise<void>;
  handleJoin: () => Promise<void>;
  handleLeave: () => Promise<void>;
  handleUpdateStatus: (status: string) => Promise<void>;
  handleDelete: () => Promise<void>;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

interface SessionProviderProps {
  children: ReactNode;
  value: SessionContextType;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children, value }) => {
  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useEvent = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useEvent must be used within an SessionProvider');
  }
  return context;
};
