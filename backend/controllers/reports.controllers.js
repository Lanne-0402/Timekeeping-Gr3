import {
  createReportService,
  getReportsService,
  updateReportStatusService,
  exportPDFService,
  summary,
} from "../services/reports.service.js";
// thêm vào đầu file
import { 
  exportSummaryPDFService,
  getAttendanceData
 } from "../services/reports.service.js";
import PDFDocument from "pdfkit";


export async function exportSummaryPDF(req, res) {
  try {
    const { from, to } = req.query;
    const summaryData = await summary(from, to);
    const pdf = await exportSummaryPDFService(summaryData, from, to);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Baocao-${from}-to-${to}.pdf`);

    return res.send(pdf);

  } catch (err) {
    console.error("PDF ERROR:", err);
    return res.status(500).json({ success: false, message: "PDF error" });
  }
}


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

export async function getSummary(req, res) {
  try {
    const { from, to, userId } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu from/to (YYYY-MM-DD)." });
    }

    const data = await summary(from, to, userId || null);
    res.json({ success: true, data });
  } catch (err) {
    console.error("getSummary error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
