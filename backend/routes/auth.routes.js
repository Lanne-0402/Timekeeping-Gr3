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
} from "../controllers/auth.controllers.js";

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

export default router;
