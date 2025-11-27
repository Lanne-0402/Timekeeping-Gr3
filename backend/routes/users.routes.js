// routes/users.routes.js
import { Router } from "express";
import {
  getMe,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
} from "../controllers/users.controllers.js";

import authMiddleware from "../middleware/auth.middleware.js";
import adminOnly from "../middleware/admin.middleware.js";
import selfOrAdmin from "../middleware/selfOrAdmin.middleware.js";

const router = Router();

// User xem chính mình
router.get("/me", authMiddleware, getMe);

// Admin xem toàn bộ user (trừ admin)
router.get("/", authMiddleware, adminOnly, getUsers);

// Admin hoặc user xem 1 user
router.get("/:userId", authMiddleware, selfOrAdmin, getUser);

// User sửa chính mình hoặc admin/manager sửa bất kỳ ai
router.patch("/:userId", authMiddleware, selfOrAdmin, updateUser);

// Admin xóa user (xoá sạch dữ liệu)
router.delete("/:userId", authMiddleware, adminOnly, deleteUser);

export default router;
