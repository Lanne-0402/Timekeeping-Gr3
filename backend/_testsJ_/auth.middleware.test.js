import jwt from 'jsonwebtoken';
import authMiddleware from '../middleware/auth.middleware.js';

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let req, res, next;
  const JWT_SECRET = 'test-secret';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment
    process.env.JWT_SECRET = JWT_SECRET;

    req = {
      headers: {},
      query: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('Token in Authorization Header', () => {
    it('should authenticate with valid token in Authorization header', () => {
      const token = 'valid-jwt-token';
      const decoded = { userId: 'user123', role: 'user', email: 'test@example.com' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, JWT_SECRET);
      expect(req.user).toEqual(decoded);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should extract token correctly from Bearer header', () => {
      const token = 'test-token-123';
      const decoded = { userId: 'user123' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, JWT_SECRET);
    });

    it('should fail with invalid Authorization header format', () => {
      req.headers.authorization = 'InvalidFormat token123';

      authMiddleware(req, res, next);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail with expired token', () => {
      const token = 'expired-token';
      req.headers.authorization = `Bearer ${token}`;

      jwt.verify.mockImplementation(() => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail with invalid signature', () => {
      const token = 'invalid-signature-token';
      req.headers.authorization = `Bearer ${token}`;

      jwt.verify.mockImplementation(() => {
        const error = new Error('invalid signature');
        error.name = 'JsonWebTokenError';
        throw error;
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });
  });

  describe('Token in Query Parameter', () => {
    it('should authenticate with valid token in query parameter', () => {
      const token = 'valid-query-token';
      const decoded = { userId: 'user123', role: 'user' };

      req.query.token = token;
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, JWT_SECRET);
      expect(req.user).toEqual(decoded);
      expect(next).toHaveBeenCalled();
    });

    it('should prioritize Authorization header over query parameter', () => {
      const headerToken = 'header-token';
      const queryToken = 'query-token';
      const decoded = { userId: 'user123' };

      req.headers.authorization = `Bearer ${headerToken}`;
      req.query.token = queryToken;
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(headerToken, JWT_SECRET);
      expect(jwt.verify).not.toHaveBeenCalledWith(queryToken, JWT_SECRET);
    });

    it('should use query token when Authorization header is missing', () => {
      const queryToken = 'query-token-123';
      const decoded = { userId: 'user123' };

      req.query.token = queryToken;
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(queryToken, JWT_SECRET);
      expect(next).toHaveBeenCalled();
    });

    it('should use query token when Authorization header is malformed', () => {
      const queryToken = 'query-token-123';
      const decoded = { userId: 'user123' };

      req.headers.authorization = 'NotBearer token';
      req.query.token = queryToken;
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith(queryToken, JWT_SECRET);
    });
  });

  describe('Missing Token', () => {
    it('should fail when no token is provided', () => {
      authMiddleware(req, res, next);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should fail when Authorization header exists but does not start with Bearer', () => {
      req.headers.authorization = 'Basic user:password';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing token'
      });
    });

    it('should fail when Authorization header is empty string', () => {
      req.headers.authorization = '';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing token'
      });
    });
  });

  describe('Token Payload', () => {
    it('should attach decoded user to request object', () => {
      const token = 'valid-token';
      const decoded = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'admin',
        name: 'Test User'
      };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      expect(req.user).toEqual(decoded);
      expect(req.user.userId).toBe('user123');
      expect(req.user.email).toBe('user@example.com');
      expect(req.user.role).toBe('admin');
      expect(req.user.name).toBe('Test User');
    });

    it('should handle minimal token payload', () => {
      const token = 'valid-token';
      const decoded = { userId: 'user123' };

      req.headers.authorization = `Bearer ${token}`;
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      expect(req.user).toEqual(decoded);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should log error and return 401 on verification failure', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const token = 'invalid-token';
      req.headers.authorization = `Bearer ${token}`;

      const error = new Error('Token verification failed');
      jwt.verify.mockImplementation(() => {
        throw error;
      });

      authMiddleware(req, res, next);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Auth error:', error);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed JWT', () => {
      const token = 'malformed.jwt.token';
      req.headers.authorization = `Bearer ${token}`;

      jwt.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle Authorization header with extra spaces', () => {
      const token = 'valid-token';
      const decoded = { userId: 'user123' };

      req.headers.authorization = `Bearer  ${token}`; // Extra space
      jwt.verify.mockReturnValue(decoded);

      authMiddleware(req, res, next);

      // The middleware splits by space and takes [1], so with extra space it gets empty string
      // This should fail since token extraction won't work correctly
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle case-sensitive Bearer keyword', () => {
      req.headers.authorization = 'bearer valid-token'; // lowercase

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Missing token'
      });
    });

    it('should not modify request object on failure', () => {
      req.headers.authorization = 'Bearer invalid-token';
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authMiddleware(req, res, next);

      expect(req.user).toBeUndefined();
    });
  });
});