import express from "express";
import adminOnly from "../middleware/admin.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";

import {
  createReport,
  getReports,
  updateReportStatus,
  exportReportPDF,
} from "../controllers/reports.controllers.js";

const router = express.Router();

router.post("/", authMiddleware, adminOnly, createReport);
router.get("/", authMiddleware, adminOnly, getReports);
router.patch("/:reportId", authMiddleware, adminOnly, updateReportStatus);

// Export PDF
router.get("/:reportId/pdf", authMiddleware, adminOnly, exportReportPDF);

export default router;
