const jwt = require('jsonwebtoken');

/**
 * JWT authentication middleware.
 * Expects header:  Authorization: Bearer <token>
 * On success, attaches decoded payload to req.user = { userId, email }
 */
const auth = (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }

    // Support both "Bearer <token>" and bare "<token>" formats
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({ message: 'No authentication token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired, please login again' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid authentication token' });
    }
    return res.status(500).json({ message: 'Authentication error' });
  }
};

module.exports = auth;
