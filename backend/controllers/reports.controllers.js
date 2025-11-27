// controllers/reports.controllers.js
import {
  createReportService,
  getReportsService,
  updateReportStatusService,
  exportPDFService,
} from "../services/reports.service.js";

export const createReport = async (req, res) => {
  try {
    const data = await createReportService(req.body);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("createReport error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getReports = async (req, res) => {
  try {
    const data = await getReportsService();
    res.json({ success: true, data });
  } catch (err) {
    console.error("getReports error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateReportStatus = async (req, res) => {
  try {
    const result = await updateReportStatusService(
      req.params.reportId,
      req.body.status
    );
    res.json({ success: true, data: result });
  } catch (err) {
    console.error("updateReportStatus error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

export const exportReportPDF = async (req, res) => {
  try {
    const buffer = await exportPDFService(req.params.reportId);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=report-${req.params.reportId}.pdf`
    );
    res.send(buffer);
  } catch (err) {
    console.error("exportReportPDF error:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};
