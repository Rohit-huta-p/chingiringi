import jwt from 'jsonwebtoken';
import User from '../modules/users/userModel.js';

export const protect = async (req, res, next) => {
  let token;

  // Read access token from the cookie
  token = req.cookies.accessToken;

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
