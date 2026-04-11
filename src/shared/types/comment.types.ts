/**
 * Comment-related TypeScript interfaces based on Prisma schema
 */

import { PublicUser } from './user.types';

// Comment
export interface Comment {
  id: string;
  content: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  sessionId: string;
  userId: string;
  parentId?: string | null;
}

// Comment with relations
export interface CommentWithDetails extends Comment {
  user?: PublicUser;
  parent?: Comment | null;
  replies?: CommentWithDetails[];
  mentions?: CommentMention[];
  _count?: {
    replies: number;
  };
}

// Comment Mention
export interface CommentMention {
  id: string;
  commentId: string;
  userId: string;
  createdAt: Date | string;
  user?: PublicUser;
}

// Create Comment data
export interface CreateCommentData {
  content: string;
  sessionId: string;
  parentId?: string;
  mentionedUserIds?: string[];
}

// Update Comment data
export interface UpdateCommentData {
  content: string;
}
