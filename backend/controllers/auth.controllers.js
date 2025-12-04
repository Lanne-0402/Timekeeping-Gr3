// backend/controllers/auth.controllers.js
import {
  registerUserService,
  loginUserService,
  refreshTokenService,
  logoutUserService,
  sendOtpService,
  verifyOtpService,
  forgotPasswordService,
  checkResetOtpService,
  resetPasswordService,
} from "../services/auth.service.js";
import bcrypt from "bcryptjs";
import db from "../config/firebase.js";

export const registerUser = async (req, res) => {
  try {
    const result = await registerUserService(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("registerUser error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const sendOtp = async (req, res) => {
  try {
    const result = await sendOtpService(req.body.email);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("sendOtp error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp, name, password } = req.body;
    const result = await verifyOtpService({ email, otp, name, password });
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("verifyOtp error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const result = await loginUserService(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("loginUser error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const result = await refreshTokenService(req.body.refreshToken);
    if (!result.success) {
      return res.status(401).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("refreshToken error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const result = await logoutUserService(req.body.refreshToken);
    return res.json(result);
  } catch (err) {
    console.error("logoutUser error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await forgotPasswordService(email);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    console.error("forgotPassword ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống.",
    });
  }
};


export const checkResetOtp = async (req, res) => {
  try {
    const result = await checkResetOtpService(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("checkResetOtp error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const result = await resetPasswordService(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("resetPassword error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
};


export async function changePassword(req, res) {
  try {
    const uid = req.user.id || req.user.uid || req.user.userId;
    if (!uid) {
      return res.status(400).json({
        success: false,
        message: "Token không hợp lệ (không tìm thấy user id).",
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.json({ success: false, message: "Thiếu dữ liệu." });
    }

    // Lấy user từ Firestore
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
      return res.json({ success: false, message: "Không tìm thấy người dùng." });
    }

    const user = snap.data();

    // Kiểm tra mật khẩu cũ
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      return res.json({
        success: false,
        message: "Mật khẩu hiện tại không đúng.",
      });
    }

    // Hash mật khẩu mới
    const hash = await bcrypt.hash(newPassword, 10);

    // Update mật khẩu mới
    await db.collection("users").doc(uid).update({
      passwordHash: hash,
      updatedAt: new Date(),
    });

    return res.json({
      success: true,
      message: "Đổi mật khẩu thành công.",
    });
  } catch (err) {
    console.error("changePassword ERROR:", err);
    return res.status(500).json({ success: false, message: "Lỗi hệ thống." });
  }
}

