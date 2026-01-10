/**
 * Re-export Group types from shared types
 */
export * from '../../../shared/types/group.types';
export * from '../../../shared/types/event.types';

// Legacy/UI-specific types that may still be used in some components
export interface Member {
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
  online: boolean;
}

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}
