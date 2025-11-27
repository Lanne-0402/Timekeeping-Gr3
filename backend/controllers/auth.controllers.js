// backend/controllers/auth.controllers.js
import {
  registerUserService,
  loginUserService,
  refreshTokenService,
  logoutUserService,
  sendOtpService,
  verifyOtpService,
  forgotPasswordService,
} from "../services/auth.service.js";

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
    const result = await forgotPasswordService(req.body.email);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
