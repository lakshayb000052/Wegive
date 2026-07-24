import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'danapro_local_jwt_secret_token_change_in_production';

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    role: 'superadmin' | 'admin';
    organizationId?: string;
    orgSlug?: string;
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.token;

  // Fallback to headers (for API testing/third-party widgets)
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required: Session token missing.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token.' });
  }
}

export function authorizeRole(roles: Array<'superadmin' | 'admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access forbidden: Insufficient roles.' });
    }
    next();
  };
}
