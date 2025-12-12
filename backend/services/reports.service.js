// services/reports.service.js
import db from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";
import PDFDocument from "pdfkit";
import { Timestamp } from "firebase-admin/firestore";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Tạo __dirname cho ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục fonts đặt đúng vị trí
const FONT_DIR = path.join(__dirname, "..", "fonts");

// Đăng ký font Times New Roman
function registerFonts(doc) {
  doc.registerFont("Times", path.join(FONT_DIR, "TIMES.TTF"));
  doc.registerFont("TimesBold", path.join(FONT_DIR, "TIMESBD.TTF"));
}



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
  const attSnap = await db.collection(ATTENDANCE_COLLECTION)
  .where("date", ">=", report.fromDate)
  .where("date", "<=", report.toDate)
  .get();
  const attendance = attSnap.docs.map(d => d.data());
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
export async function summary(from, to) {
  // 1) user_shifts chỉ trong khoảng ngày
  const shiftSnap = await db.collection("user_shifts")
    .where("date", ">=", from)
    .where("date", "<=", to)
    .get();

  const assignments = shiftSnap.docs.map(d => d.data());

  // 2) attendance chỉ trong khoảng ngày
  const attSnap = await db.collection(ATTENDANCE_COLLECTION)
    .where("date", ">=", from)
    .where("date", "<=", to)
    .get();

  const attendance = attSnap.docs.map(d => d.data());

  // 3) users & shifts vẫn có thể get full (ít record hơn nhiều)
  const usersSnap = await db.collection(USERS_COLLECTION).get();
  const users = usersSnap.docs.map(d => d.data());
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  const shiftsSnap = await db.collection("shifts").get();
  const shifts = shiftsSnap.docs.map(d => d.data());
  const shiftMap = {};
  shifts.forEach(s => { shiftMap[s.id] = s; });

  // -------------------------
  // TỔNG QUAN TOÀN CÔNG TY
  // -------------------------
  const totalAssignments = assignments.length;

  // Có mặt = có bản ghi attendance trùng userId + date
  let present = 0;
  let totalHours = 0;

  // perUser: { userId: { assigned, present, absent } }
  const perUser = {};

  // details: từng ca
  const details = [];

  for (const asg of assignments) {
    const uid = asg.userId;
    const date = asg.date;
    const shift = shiftMap[asg.shiftId] || {};
    const user = userMap[uid] || {};

    // init perUser
    if (!perUser[uid]) {
      perUser[uid] = { assigned: 0, present: 0, absent: 0 };
    }
    perUser[uid].assigned++;

    // tìm attendance tương ứng
    const att = attendance.find(
      a => a.userId === uid && a.date === date
    );

    let checkInAt = att?.checkInAt || null;
    let checkOutAt = att?.checkOutAt || null;

    let isPresent = false;
    let workHours = 0;

    if (checkInAt) {
      isPresent = true;

      // Tính giờ làm chỉ khi có cả check-in & check-out
      if (checkOutAt) {
        const inTime = new Date(checkInAt);
        const outTime = new Date(checkOutAt);

        if (!isNaN(inTime) && !isNaN(outTime)) {
          const diffMs = outTime - inTime;
          const hours = diffMs / (1000 * 60 * 60);
          workHours = hours > 0 ? hours : 0;
          totalHours += workHours;
        }
      }
    }


    if (isPresent) {
      present++;
      perUser[uid].present++;
    } else {
      perUser[uid].absent++;
    }

    // Tính đi muộn / về sớm (đơn giản – có thể refine sau)
    let lateMinutes = null;
    let earlyMinutes = null;

    // ----- Đi muộn -----
    if (shift.startTime && checkInAt) {
      const shiftStart = new Date(`${date}T${shift.startTime}:00`);
      const inTime = new Date(checkInAt);

      if (!isNaN(inTime) && !isNaN(shiftStart)) {
        const diff = (inTime - shiftStart) / (1000 * 60);
        lateMinutes = diff > 0 ? Math.round(diff) : 0;
      }
    }

    // ----- Về sớm -----
    if (shift.endTime && checkOutAt) {
      const shiftEnd = new Date(`${date}T${shift.endTime}:00`);
      const outTime = new Date(checkOutAt);

      if (!isNaN(outTime) && !isNaN(shiftEnd)) {
        const diff = (shiftEnd - outTime) / (1000 * 60);
        earlyMinutes = diff > 0 ? Math.round(diff) : 0;
      }
    }
    
    const isLate = lateMinutes !== null && lateMinutes > 0;
    const isEarly = earlyMinutes !== null && earlyMinutes > 0;


    // Các lỗi chấm công
    const missingCheckIn = !checkInAt;
    const missingCheckOut = !checkOutAt;
    const checkoutWithoutCheckin = !!checkOutAt && !checkInAt;

    details.push({
      date,
      userId: uid,
      employeeCode: user.employeeCode || "N/A",  
      userName: user.name || user.email || "Không rõ",
      shiftId: asg.shiftId,
      shiftName: shift.name || "",
      shiftStart: shift.startTime || "",
      shiftEnd: shift.endTime || "",
      checkInAt,
      checkOutAt,
      workHours: Number(workHours.toFixed(2)),
      lateMinutes,
      earlyMinutes,
      isLate,
      isEarly,
      missingCheckIn,
      missingCheckOut,
      checkoutWithoutCheckin
    });

  }
  

  const absent = totalAssignments - present;

  // Tổng giờ làm đã tính trong loop (từ attendance hợp lệ)
  totalHours = Number(totalHours.toFixed(2));

  // -------------------------
  // DANH SÁCH NHÂN VIÊN
  // -------------------------
  const employees = users
    .filter(u => u.role !== "admin" && u.role !== "System Admin")
    .map(u => {
      const stat = perUser[u.id] || { assigned: 0, present: 0, absent: 0 };
      return {
        userId: u.id,
        employeeCode: u.employeeCode || "N/A",
        name: u.name,
        email: u.email,
        assigned: stat.assigned,
        present: stat.present,
        absent: stat.absent,
        attendanceRate: stat.assigned
          ? stat.present / stat.assigned
          : 0,
      };
    });

  return {
    totalAssignments,
    present,
    absent,
    attendanceRate: totalAssignments ? present / totalAssignments : 0,
    totalHours,
    employees,
    details,
  };
}

// reports.service.js (nối tiếp sau hàm summary(from, to) hiện tại)

// Xuất PDF cho summary theo khoảng ngày
export async function exportSummaryPDFService(summary, from, to) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });

      let buffers = [];
      doc.on("data", buffers.push.bind(buffers));

      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });

      // Load fonts
      doc.registerFont("Times", path.join(FONT_DIR, "TIMES.TTF"));
      doc.registerFont("Times-Bold", path.join(FONT_DIR, "TIMESBD.TTF"));

      // ===== HEADER =====
      doc.font("Times-Bold").fontSize(18).text("BÁO CÁO DỮ LIỆU CHẤM CÔNG", { align: "center" });
      doc.moveDown(0.5);
      doc.font("Times").fontSize(12).text(`Từ ngày ${from} đến ngày ${to}`, { align: "center" });
      doc.moveDown(1.5);

      // ===== TABLE HEADER =====
      const tableTop = doc.y + 10;
      const rowHeight = 22;

      const col = {
        stt: 40,
        name: 70,
        date: 240,
        ci1: 320,
        co1: 380,
        ci2: 440,
        co2: 500,
      };

      // Header
      doc.font("Times-Bold").fontSize(11);
      doc.text("STT", col.stt, tableTop, { width: 30 });
      doc.text("Nhân viên", col.name, tableTop, { width: 100 });
      doc.text("Ngày", col.date, tableTop, { width: 70 });
      doc.text("Check-in 1", col.ci1, tableTop, { width: 60 });
      doc.text("Check-out 1", col.co1, tableTop, { width: 60 });
      doc.text("Check-in 2", col.ci2, tableTop, { width: 60 });
      doc.text("Check-out 2", col.co2, tableTop, { width: 60 });

      // kẻ line dưới header
      doc.moveTo(40, tableTop + rowHeight)
        .lineTo(560, tableTop + rowHeight)
        .stroke();

      // ===== ROWS =====
      doc.font("Times").fontSize(11);

      let y = tableTop + rowHeight + 8;

      summary.details.forEach((r, index) => {

        // nếu xuống trang
        if (y > 780) {
          doc.addPage();
          y = 40;
        }

        const ci1 = r.checkInAt
          ? new Date(r.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
          : "-";
        const co1 = r.checkOutAt
          ? new Date(r.checkOutAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
          : "-";

        doc.text(index + 1, col.stt, y, { width: 30 });
        doc.text(r.userName || "-", col.name, y, { width: 150 });
        doc.text(r.date, col.date, y, { width: 70 });
        doc.text(ci1, col.ci1, y, { width: 50 });
        doc.text(co1, col.co1, y, { width: 60 });
        doc.text("-", col.ci2, y, { width: 50 });
        doc.text("-", col.co2, y, { width: 60 });

        y += rowHeight;
      });
            doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

export async function getAttendanceData(from, to) {
  const snap = await db
    .collection("attendance")
    .where("date", ">=", from)
    .where("date", "<=", to)
    .orderBy("date", "asc")
    .get();

  const list = snap.docs.map((d) => d.data());

  // Gom dữ liệu theo user + date
  const map = {};

  list.forEach((row) => {
    const key = `${row.userId}_${row.date}`;

    if (!map[key]) {
      map[key] = {
        userId: row.userId,
        userName: row.userName,
        date: row.date,
        times: [] // mỗi phần tử là {checkInAt, checkOutAt}
      };
    }

    map[key].times.push({
      checkInAt: row.checkInAt || null,
      checkOutAt: row.checkOutAt || null
    });
  });

  return Object.values(map);
}