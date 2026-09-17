import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db';
import { User, Role, CustomRole } from '../src/types';

const JWT_SECRET = process.env.JWT_SECRET || 'nash-85th-anniversary-secret-key-2027';

export interface AuthRequest extends Request {
  user?: User;
}

export class AuthService {
  static generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        batch: user.batch,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  static verifyToken(token: string): User | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const users = db.get('users');
      const found = users.find(u => u.id === decoded.id || u.email === decoded.email || u.username === decoded.username);
      if (found) {
        const { password_hash, ...safeUser } = found;
        return safeUser;
      }
      return {
        id: decoded.id,
        username: decoded.username || 'user',
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
        batch: decoded.batch,
        status: 'active',
        created_at: new Date().toISOString(),
      };
    } catch (e) {
      return null;
    }
  }

  static hasPermission(user: User, permission: string): boolean {
    if (user.role === 'super_admin') {
      return true;
    }

    // Direct permissions on user object
    if (user.permissions && user.permissions.includes(permission)) {
      return true;
    }

    // Role-based permissions from database
    const roles: CustomRole[] = db.get('roles') || [];
    const userRole = roles.find(r => r.id === user.role || r.id === `role-${user.role.replace('_', '-')}` || (r.name && user.role && r.name.toLowerCase() === user.role.toLowerCase()));
    if (userRole && userRole.permissions.includes(permission)) {
      return true;
    }

    return false;
  }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  const user = AuthService.verifyToken(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired session token' });
  }

  req.user = user;
  next();
}

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (req.user.role === 'super_admin') {
      return next();
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!AuthService.hasPermission(req.user, permission)) {
      return res.status(403).json({ message: `Forbidden: Missing required permission '${permission}'` });
    }
    next();
  };
}
