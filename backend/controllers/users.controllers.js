// controllers/users.controllers.js
import { UsersService } from "../services/users.service.js";

// Lấy chính mình (từ token)
export const getMe = async (req, res) => {
  try {
    const user = await UsersService.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Admin lấy danh sách user (ẩn admin)
export const getUsers = async (req, res) => {
  try {
    const data = await UsersService.getUsers();
    res.json({ success: true, data });
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Lấy 1 user (self hoặc admin/manager)
export const getUser = async (req, res) => {
  try {
    const data = await UsersService.getUserById(req.params.userId);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy user" });
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error("getUser error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update user (self hoặc admin/manager)
export const updateUser = async (req, res) => {
  try {
    const currentUser = req.user; // { userId, role }
    const targetUserId = req.params.userId;
    const updates = req.body;

    const data = await UsersService.updateUser(currentUser, targetUserId, updates);
    res.json({ success: true, data });
  } catch (err) {
    console.error("updateUser error:", err);
    res
      .status(400)
      .json({ success: false, message: err.message || "Update failed" });
  }
};

// Xoá user (admin)
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    await UsersService.deleteUser(userId);
    res.json({
      success: true,
      message: "Đã xoá nhân viên và toàn bộ dữ liệu liên quan.",
    });
  } catch (err) {
    console.error("deleteUser error:", err);
    res
      .status(400)
      .json({ success: false, message: err.message || "Delete failed" });
  }
};
