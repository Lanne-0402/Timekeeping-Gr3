// routes/requests.routes.js
import { Router } from "express";

import {
  createRequest,
  getMyRequests,
  getAllRequests,
  updateRequestStatus,
} from "../controllers/requests.controllers.js";

import authMiddleware from "../middleware/auth.middleware.js";
import adminOnly from "../middleware/admin.middleware.js";

const router = Router();

// Nhân viên gửi yêu cầu chỉnh sửa / khiếu nại
router.post("/", authMiddleware, createRequest);

// Nhân viên xem yêu cầu của chính mình
router.get("/mine", authMiddleware, getMyRequests);

// (Backward-compatible)
router.get("/my", authMiddleware, getMyRequests);

// Admin xem toàn bộ yêu cầu
router.get("/", authMiddleware, adminOnly, getAllRequests);

// Admin duyệt / từ chối yêu cầu
router.patch("/:requestId", authMiddleware, adminOnly, updateRequestStatus);

export default router;
