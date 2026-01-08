import jwt from 'jsonwebtoken';
import { SESSION } from '../config/security';

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-here';

interface TokenPayload {
  userId: string;
}

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, SECRET_KEY, { 
    expiresIn: `${SESSION.JWT_EXPIRY_DAYS}d` 
  });
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, SECRET_KEY) as TokenPayload;
  } catch (error) {
    return null;
  }
};
