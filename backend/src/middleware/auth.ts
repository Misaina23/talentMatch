import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types.ts';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export interface AuthRequest extends Request {
  authUser?: JwtPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'talentmatch-local-dev-secret-2026';

export function signAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    req.authUser = verifyAuthToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expirée ou invalide' });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    try {
      req.authUser = verifyAuthToken(token);
    } catch {
      // Ignore invalid optional token
    }
  }
  next();
}
