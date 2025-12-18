import adminOnly from '../middleware/admin.middleware.js';

describe('Admin Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: null
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('Authorized Admin Roles', () => {
    it('should allow access for user with "admin" role', () => {
      req.user = { userId: 'user1', role: 'admin' };

      adminOnly(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access for user with "System Admin" role', () => {
      req.user = { userId: 'user2', role: 'System Admin' };

      adminOnly(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access for user with "manager" role', () => {
      req.user = { userId: 'user3', role: 'manager' };

      adminOnly(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Unauthorized Access', () => {
    it('should block access for user without admin role', () => {
      req.user = { userId: 'user4', role: 'user' };

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin only'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block access for user with "employee" role', () => {
      req.user = { userId: 'user5', role: 'employee' };

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin only'
      });
    });

    it('should block access when req.user does not exist', () => {
      req.user = null;

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should block access when req.user is undefined', () => {
      req.user = undefined;

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should block access when role is null', () => {
      req.user = { userId: 'user6', role: null };

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin only'
      });
    });

    it('should block access when role is undefined', () => {
      req.user = { userId: 'user7', role: undefined };

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin only'
      });
    });

    it('should block access when role is empty string', () => {
      req.user = { userId: 'user8', role: '' };

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin only'
      });
    });

    it('should be case-sensitive for role names', () => {
      req.user = { userId: 'user9', role: 'Admin' }; 

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin only'
      });
    });

    it('should block access for role with extra spaces', () => {
      req.user = { userId: 'user10', role: ' admin ' };

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin only'
      });
    });

    it('should handle user object without role property', () => {
      req.user = { userId: 'user11' }; 

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Admin only'
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in a middleware chain after auth middleware', () => {
      req.user = {
        userId: 'admin123',
        role: 'admin',
        email: 'admin@example.com'
      };

      adminOnly(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should prevent access when auth middleware did not set req.user', () => {
      req.user = null;

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow all three admin role types in sequence', () => {
      const roles = ['admin', 'System Admin', 'manager'];

      roles.forEach(role => {
        req.user = { userId: 'user', role };
        next.mockClear();
        res.status.mockClear();

        adminOnly(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('Security Considerations', () => {
    it('should return 401 before 403 when user is not authenticated', () => {
      req.user = null;

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('should not leak information about valid admin roles in error message', () => {
      req.user = { userId: 'user', role: 'guest' };

      adminOnly(req, res, next);

      const responseMessage = res.json.mock.calls[0][0].message;
      expect(responseMessage).not.toContain('admin');
      expect(responseMessage).not.toContain('manager');
      expect(responseMessage).not.toContain('System Admin');
    });

    it('should handle potential injection attempts in role field', () => {
      req.user = { userId: 'user', role: "admin' OR '1'='1" };

      adminOnly(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});