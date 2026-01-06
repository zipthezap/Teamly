import React, { createContext, useContext, ReactNode } from 'react';

interface EventContextType {
  event: any | null;
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

const EventContext = createContext<EventContextType | null>(null);

interface EventProviderProps {
  children: ReactNode;
  value: EventContextType;
}

export const EventProvider: React.FC<EventProviderProps> = ({ children, value }) => {
  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};

export const useEvent = (): EventContextType => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
};
