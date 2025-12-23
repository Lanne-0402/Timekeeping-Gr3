import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import adminOnly from "../middleware/admin.middleware.js";
import {
  createShift,
  getShifts,
  assignShift,
  getUserShifts,
  deleteShift,
  removeEmployeeFromShift,
  addEmployeeToShift,
  getEmployeesInShift,
  getShiftById,
  updateShift,
} from "../controllers/shifts.controllers.js";

const router = express.Router();

// Admin tạo ca
router.post("/", authMiddleware, adminOnly, createShift);

// Admin xem danh sách ca
router.get("/", authMiddleware, adminOnly, getShifts);

// Admin gán ca cho nhân viên
router.post("/assign", authMiddleware, adminOnly, assignShift);

// Nhân viên lấy ca của chính mình
router.get("/user/:userId", authMiddleware, getUserShifts);

// (Optional) Admin xoá ca
router.delete("/:shiftId", authMiddleware, adminOnly, deleteShift);
router.get("/:shiftId", getShiftById);
router.get("/:shiftId/employees", getEmployeesInShift);
router.put("/:shiftId", updateShift);
router.post("/:shiftId/add-employee", addEmployeeToShift);
router.post("/:shiftId/remove-employee", removeEmployeeFromShift);


export default router;
