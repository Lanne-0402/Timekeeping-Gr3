// middlewares/selfOrAdmin.middleware.js
const ADMIN_ROLES = ["admin", "System Admin", "manager"];

export default function selfOrAdmin(req, res, next) {
  const user = req.user;
  const targetId = req.params.userId;

  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  // Chính chủ
  if (user.userId === targetId) {
    return next();
  }

  // Admin / Manager
  if (ADMIN_ROLES.includes(user.role)) {
    return next();
  }

  return res.status(403).json({ success: false, message: "Access denied" });
}
