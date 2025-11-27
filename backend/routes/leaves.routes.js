import { Router } from "express";
import {
  createLeaveRequest,
  getLeaveByUser,
  getAllLeaves,
  updateLeaveStatus
} from "../controllers/leaves.controllers.js";

import authMiddleware from "../middleware/auth.middleware.js";
import adminOnly from "../middleware/admin.middleware.js";

const router = Router();

// Employee tạo đơn nghỉ phép
router.post("/", authMiddleware, createLeaveRequest);

// Employee xem lịch sử nghỉ phép của chính mình
router.get("/user/:userId", authMiddleware, getLeaveByUser);

// Admin xem tất cả đơn nghỉ phép
router.get("/", authMiddleware, adminOnly, getAllLeaves);

// Admin duyệt / từ chối đơn nghỉ phép
router.patch("/:leaveId", authMiddleware, adminOnly, updateLeaveStatus);

export default router;
