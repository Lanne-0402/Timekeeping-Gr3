// backend/routes/auth.routes.js
import express from "express";
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  sendOtp,
  verifyOtp,
  forgotPassword,
  checkResetOtp,
  resetPassword,
  changePassword
} from "../controllers/auth.controllers.js";
import authMiddleware from "../middleware/auth.middleware.js";


const router = express.Router();

// Admin có thể tạo user trực tiếp (nếu bạn muốn dùng sau này)
router.post("/register", registerUser);

// Flow chính cho nhân viên
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

router.post("/login", loginUser);
router.post("/refresh", refreshToken);
router.post("/logout", logoutUser);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password/check", checkResetOtp);
router.post("/reset-password", resetPassword);
router.post("/change-password", authMiddleware, changePassword);
export default router;
