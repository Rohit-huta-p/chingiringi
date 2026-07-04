import jwt from 'jsonwebtoken';
import User from '../modules/users/userModel.js';

/**
 * Attach req.user if a valid token is present. Never 401s — for endpoints that
 * work both anonymously and authenticated (click logging, public reads where
 * personalization is optional). On bad/expired token: silently proceed as
 * anonymous (the request shouldn't break because their session expired).
 */
export const optionalProtect = async (req, res, next) => {
  let token = req.cookies.accessToken;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash');
  } catch {
    // bad / expired token — proceed as anonymous
  }
  next();
};

export const protect = async (req, res, next) => {
  let token;

  // Read access token from cookie or Authorization header (for native apps)
  token = req.cookies.accessToken;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      
      // Get user from the token excluding password
      req.user = await User.findById(decoded.id).select('-passwordHash');
      
      if (!req.user) {
        res.status(401);
        throw new Error('Not authorized, user not found');
      }

      next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  } else {
    res.status(401);
    throw new Error('Not authorized, no token attached to cookies');
  }
};
