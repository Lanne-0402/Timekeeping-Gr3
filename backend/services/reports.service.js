// services/reports.service.js
import db from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";
import PDFDocument from "pdfkit";
import { Timestamp } from "firebase-admin/firestore";

const REPORTS_COLLECTION = "reports";
const ATTENDANCE_COLLECTION = "attendance";
const USERS_COLLECTION = "users";

export const createReportService = async ({ title, fromDate, toDate }) => {
  if (!title || !fromDate || !toDate)
    throw new Error("Thiếu dữ liệu tạo báo cáo");

  const id = uuidv4();
  const now = Timestamp.now();

  const report = {
    id,
    title,
    fromDate,
    toDate,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(REPORTS_COLLECTION).doc(id).set(report);
  return report;
};

export const getReportsService = async () => {
  const snap = await db
    .collection(REPORTS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => d.data());
};

export const updateReportStatusService = async (reportId, status) => {
  if (!["approved", "rejected"].includes(status))
    throw new Error("Trạng thái không hợp lệ");

  const ref = db.collection(REPORTS_COLLECTION).doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Không tìm thấy report");

  const now = Timestamp.now();

  await ref.update({
    status,
    updatedAt: now,
  });

  return (await ref.get()).data();
};

// ----------------- PDF EXPORT -----------------
export const exportPDFService = async (reportId) => {
  const reportRef = db.collection(REPORTS_COLLECTION).doc(reportId);
  const reportSnap = await reportRef.get();

  if (!reportSnap.exists) throw new Error("Report không tồn tại");

  const report = reportSnap.data();

  // Lấy attendance trong khoảng report.fromDate - report.toDate
  const attSnap = await db.collection(ATTENDANCE_COLLECTION).get();
  const attendance = attSnap.docs
    .map((d) => d.data())
    .filter(
      (x) => x.date >= report.fromDate && x.date <= report.toDate
    );

  // Group theo user
  const byUser = {};
  attendance.forEach((a) => {
    if (!byUser[a.userId]) byUser[a.userId] = [];
    byUser[a.userId].push(a);
  });

  // Tạo PDF
  const doc = new PDFDocument();
  let buffers = [];
  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {});

  doc.fontSize(20).text(report.title, { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Từ ngày: ${report.fromDate}`);
  doc.text(`Đến ngày: ${report.toDate}`);
  doc.moveDown();

  doc.text(`Tổng nhân viên có dữ liệu: ${Object.keys(byUser).length}`);
  doc.moveDown(1);

  // Render từng nhân viên
  for (const userId of Object.keys(byUser)) {
    const userDoc = await db.collection(USERS_COLLECTION).doc(userId).get();
    const user = userDoc.exists ? userDoc.data() : { name: "Unknown" };

    doc.fontSize(14).text(`Nhân viên: ${user.name} (${userId})`);
    doc.fontSize(12);

    const list = byUser[userId];

    list.forEach((att) => {
      doc.text(
        ` • ${att.date} — Vào: ${att.checkInAt || "-"} — Ra: ${
          att.checkOutAt || "-"
        } — ${Math.floor((att.workSeconds || 0) / 3600)} giờ`
      );
    });

    doc.moveDown();
  }

  doc.end();

  return Buffer.concat(buffers);
};
