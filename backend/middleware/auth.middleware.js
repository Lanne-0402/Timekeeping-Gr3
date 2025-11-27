// middlewares/auth.middleware.js
import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  const token = header.split(" ")[1];

  try {
    // DÙNG ĐÚNG BIẾN TRONG .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded chứa { userId, role, ... }
    req.user = decoded;

    return next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}
