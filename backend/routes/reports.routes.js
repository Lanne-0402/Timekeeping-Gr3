import { Router } from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  createReport,
  getReports,
  updateReportStatus,
  exportReportPDF,
  getSummary,
  exportSummaryPDF,   // thêm dòng này
} from "../controllers/reports.controllers.js";

const router = Router();

// CRUD report cũ
router.post("/", authMiddleware, createReport);
router.get("/", authMiddleware, getReports);
router.patch("/:id/status", authMiddleware, updateReportStatus);

// ĐẶT CÁC ROUTE CỤ THỂ TRƯỚC
router.get("/summary", authMiddleware, getSummary);
router.get("/summary/pdf", authMiddleware, exportSummaryPDF);
// Sau cùng mới tới route động theo id
router.get("/:id/pdf", authMiddleware, exportSummaryPDF);

export default router;