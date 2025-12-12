import {
  fetchHistoryService,
  fetchSummaryService,
  adminFetchAllAttendanceService,
  adminFetchOneAttendanceService,
  adminUpdateAttendanceService
} from "../services/attendance.service.js";
import { getUserCalendarService } from "../services/attendance.service.js";

// USER — Lấy lịch sử chấm công
export const getHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const records = await fetchHistoryService(userId);
    return res.json({ success: true, data: records });
  } catch (err) {
    console.error("getHistory error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// USER — Thống kê tổng quan
export const getSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const summary = await fetchSummaryService(userId);
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error("getSummary error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ADMIN — Lấy toàn bộ attendance
export const adminGetAllAttendance = async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Thiếu from/to (YYYY-MM-DD)",
      });
    }

    const data = await adminFetchAllAttendanceService(from, to);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("adminGetAllAttendance error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ADMIN — Lấy 1 doc attendance
export const adminGetOneAttendance = async (req, res) => {
  try {
    const { docId } = req.params;
    const data = await adminFetchOneAttendanceService(docId);
    if (!data) return res.status(404).json({ success: false, message: "Không tìm thấy" });
    return res.json({ success: true, data });
  } catch (err) {
    console.error("adminGetOneAttendance error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ADMIN — Update giờ công
export const adminUpdateAttendance = async (req, res) => {
  try {
    const { docId } = req.params;
    const updates = req.body;
    const result = await adminUpdateAttendanceService(docId, updates);
    return res.json(result);
  } catch (err) {
    console.error("adminUpdateAttendance error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getUserCalendar = async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query; // format YYYY-MM

    if (!month) {
      return res.status(400).json({ success: false, message: "Thiếu month (YYYY-MM)." });
    }

    const data = await getUserCalendarService(userId, month);
    return res.json({ success: true, data });

  } catch (err) {
    console.error("getUserCalendar error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
