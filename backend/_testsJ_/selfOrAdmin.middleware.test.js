import selfOrAdmin from '../middleware/selfOrAdmin.middleware.js';

describe('SelfOrAdmin Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: null,
      params: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('User Accessing Own Data', () => {
    it('should allow user to access their own data', () => {
      req.user = { userId: 'user123', role: 'employee' };
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow user to access own data regardless of role', () => {
      req.user = { userId: 'user456', role: 'user' };
      req.params.userId = 'user456';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should match userId exactly (case-sensitive)', () => {
      req.user = { userId: 'User123', role: 'employee' };
      req.params.userId = 'User123';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Admin Access', () => {
    it('should allow admin to access any user data', () => {
      req.user = { userId: 'admin1', role: 'admin' };
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow System Admin to access any user data', () => {
      req.user = { userId: 'sysadmin1', role: 'System Admin' };
      req.params.userId = 'user456';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow manager to access any user data', () => {
      req.user = { userId: 'manager1', role: 'manager' };
      req.params.userId = 'user789';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow admin to access their own data', () => {
      req.user = { userId: 'admin1', role: 'admin' };
      req.params.userId = 'admin1';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Access Denied', () => {
    it('should deny regular user accessing other user data', () => {
      req.user = { userId: 'user123', role: 'employee' };
      req.params.userId = 'user456';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny employee accessing other employee data', () => {
      req.user = { userId: 'emp1', role: 'employee' };
      req.params.userId = 'emp2';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied'
      });
    });

    it('should deny user with undefined role', () => {
      req.user = { userId: 'user123' };
      req.params.userId = 'user456';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should deny user with null role', () => {
      req.user = { userId: 'user123', role: null };
      req.params.userId = 'user456';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should deny user with empty role', () => {
      req.user = { userId: 'user123', role: '' };
      req.params.userId = 'user456';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Unauthorized Access', () => {
    it('should return 401 when user is not authenticated', () => {
      req.user = null;
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unauthorized'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when user is undefined', () => {
      req.user = undefined;
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should deny when userId does not match (case-sensitive)', () => {
      req.user = { userId: 'user123', role: 'employee' };
      req.params.userId = 'User123'; 

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny when userId has extra spaces', () => {
      req.user = { userId: 'user123', role: 'employee' };
      req.params.userId = 'user123 '; // Extra space

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle missing targetId parameter', () => {
      req.user = { userId: 'user123', role: 'employee' };
      req.params.userId = undefined;

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle empty targetId parameter', () => {
      req.user = { userId: 'user123', role: 'employee' };
      req.params.userId = '';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should be case-sensitive for admin roles', () => {
      req.user = { userId: 'admin1', role: 'Admin' }; 
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should not allow roles with extra spaces', () => {
      req.user = { userId: 'admin1', role: ' admin ' };
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Security Scenarios', () => {
    it('should prevent privilege escalation', () => {
      req.user = { userId: 'user123', role: 'employee' };
      req.params.userId = 'admin1';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 before 403 when not authenticated', () => {
      req.user = null;
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    it('should handle injection attempts in userId', () => {
      req.user = { userId: 'user123', role: 'employee' };
      req.params.userId = "user123' OR '1'='1";

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle injection attempts in role', () => {
      req.user = { userId: 'user123', role: "employee' OR 'admin" };
      req.params.userId = 'user456';

      selfOrAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in a middleware chain after auth', () => {
      req.user = { userId: 'user123', role: 'employee', email: 'user@example.com' };
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow all admin roles sequentially', () => {
      const adminRoles = ['admin', 'System Admin', 'manager'];

      adminRoles.forEach(role => {
        req.user = { userId: 'admin1', role };
        req.params.userId = 'user123';
        next.mockClear();
        res.status.mockClear();

        selfOrAdmin(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    it('should prioritize self check before admin check', () => {
      req.user = { userId: 'user123', role: 'invalid-role' };
      req.params.userId = 'user123';

      selfOrAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});