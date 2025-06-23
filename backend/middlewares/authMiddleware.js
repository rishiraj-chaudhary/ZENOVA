import jwt from 'jsonwebtoken';
import User from '../models/user.js';

const protect = async (req, res, next) => {
  let token;
  
  // First check for JWT in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    console.log('Auth header:', req.headers.authorization);
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Set user in request
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ message: 'user not found' });
      }
      
      return next();
    } catch (error) {
      console.error("JWT auth error:", error);
      return res.status(401).json({ message: 'Not authorized, token invalid' });
    }
  }
  
  // Fall back to session auth if no JWT
  if (req.session && req.session.user) {
    try {
      const sessionUser = await User.findById(req.session.user._id).select('-password');
      if (!sessionUser) {
        return res.status(401).json({ message: 'user not found' });
      }
      
      req.user = sessionUser;
      return next();
    } catch (error) {
      console.error("Session auth error:", error);
      return res.status(401).json({ message: 'Not authorized' });
    }
  }
  
  // No authentication found
  return res.status(401).json({ message: 'Not authorized, no authentication provided' });
};

export default protect;