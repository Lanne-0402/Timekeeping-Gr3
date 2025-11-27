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

// USER — Lấy lịch sử + tổng quan
router.get("/history", authMiddleware, getHistory);
router.get("/summary", authMiddleware, getSummary);

// ADMIN — Lấy toàn bộ + 1 ngày + chỉnh giờ
router.get("/", authMiddleware, adminOnly, adminGetAllAttendance);
router.get("/:docId", authMiddleware, adminOnly, adminGetOneAttendance);
router.patch("/:docId", authMiddleware, adminOnly, adminUpdateAttendance);
// API Calendar tổng hợp
router.get("/calendar/:userId", authMiddleware, getUserCalendar);


export default router;
