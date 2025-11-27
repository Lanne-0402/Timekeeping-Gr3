// middlewares/admin.middleware.js
const ADMIN_ROLES = ["admin", "System Admin", "manager"];

export default function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!ADMIN_ROLES.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Admin only" });
  }

  next();
}
