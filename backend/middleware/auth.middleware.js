// middlewares/auth.middleware.js
import jwt from "jsonwebtoken";

export default function authMiddleware(req, res, next) {
  let token = null;

  // 1️⃣ Lấy token từ header nếu có
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }

  // 2️⃣ Nếu không có header → thử lấy từ query (dùng cho window.open PDF)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  // 3️⃣ Vẫn không có token → reject
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    return next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

