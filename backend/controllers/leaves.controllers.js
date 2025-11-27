// controllers/leaves.controllers.js
import { LeavesService } from "../services/leaves.service.js";

// Nhân viên tạo đơn nghỉ phép
export const createLeaveRequest = async (req, res) => {
  try {
    const userId = req.user.userId; // luôn lấy từ token
    const { reason, date } = req.body;

    if (!reason || !date) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu lý do hoặc ngày nghỉ" });
    }

    const leave = await LeavesService.create({
      userId,
      reason,
      date,
    });

    return res.status(201).json({ success: true, data: leave });
  } catch (err) {
    console.error("createLeaveRequest error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error khi tạo đơn nghỉ phép" });
  }
};

// Nhân viên xem lịch sử nghỉ phép của chính mình
export const getLeaveByUser = async (req, res) => {
  try {
    // Để an toàn, luôn dùng userId từ token,
    // KHÔNG tin tham số trên URL
    const userId = req.user.userId;

    const leaves = await LeavesService.getByUser(userId);
    return res.json({ success: true, data: leaves });
  } catch (err) {
    console.error("getLeaveByUser error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error khi lấy danh sách nghỉ phép" });
  }
};

// Admin xem tất cả đơn nghỉ phép
export const getAllLeaves = async (req, res) => {
  try {
    const leaves = await LeavesService.getAll();
    return res.json({ success: true, data: leaves });
  } catch (err) {
    console.error("getAllLeaves error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error khi lấy danh sách nghỉ phép" });
  }
};

// Admin duyệt / từ chối đơn nghỉ phép
export const updateLeaveStatus = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status, adminNote } = req.body;
    const adminId = req.user.userId;

    if (!["approved", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Trạng thái không hợp lệ" });
    }

    const result = await LeavesService.updateStatus(
      leaveId,
      status,
      adminId,
      adminNote
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error("updateLeaveStatus error:", err);
    return res
      .status(400)
      .json({ success: false, message: err.message || "Cập nhật thất bại" });
  }
};
