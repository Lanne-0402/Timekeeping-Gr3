import express from "express";
import {
  getHistory,
  getSummary,
  getUserCalendar,
  adminGetAllAttendance,
  adminGetOneAttendance,
  adminUpdateAttendance
} from "../controllers/attendance.controllers.js";

import authMiddleware from "../middleware/auth.middleware.js";
import adminOnly from "../middleware/admin.middleware.js";

const router = express.Router();

// USER — Lịch sử chấm công
router.get("/history", authMiddleware, getHistory);

// USER — Tổng quan
router.get("/summary", authMiddleware, getSummary);

// USER — Calendar
router.get("/calendar/:userId", authMiddleware, getUserCalendar);

// ADMIN — lấy tất cả
router.get("/", authMiddleware, adminOnly, adminGetAllAttendance);

// ADMIN — 1 record
router.get("/:docId", authMiddleware, adminOnly, adminGetOneAttendance);

// ADMIN — chỉnh record
router.patch("/:docId", authMiddleware, adminOnly, adminUpdateAttendance);

export default router;
