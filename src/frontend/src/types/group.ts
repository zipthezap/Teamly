// Group, Member, Event, and ChatMessage types
export interface Member {
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
  online: boolean;
}

export interface Event {
  id: number;
  title: string;
  date: string;
  type: string;
  organizer: string;
  image?: string;
}

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
}

export interface Group {
  id: string | number;
  name: string;
  description: string;
  picture?: string;
  privacy: string;
  createdAt: string;
  members: Member[];
  events: Event[];
  chat: ChatMessage[];
}
