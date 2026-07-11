const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'growstack_super_secret_key_2026';

const verifyAdminToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Accept tokens with role='admin' OR old tokens without a role field (backward compatible)
    if (decoded.role && decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

const verifyCallerToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ message: 'No authorization header provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'caller') {
      return res.status(403).json({ message: 'Caller access required.' });
    }
    req.caller = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = {
  verifyAdminToken,
  verifyCallerToken,
  JWT_SECRET
};
