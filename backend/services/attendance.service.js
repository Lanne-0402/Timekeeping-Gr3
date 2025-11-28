import db from "../config/firebase.js";

// --------- Helper format ---------
function today() {
  return new Date().toISOString().split("T")[0];
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

// USER CHECK-IN (được gọi từ face.controller sau khi FaceID & GPS OK)
export const handleCheckInService = async (userId) => {
  const date = today();
  const docId = `${userId}_${date}`;
  const ref = db.collection("attendance").doc(docId);
  const snap = await ref.get();

  if (snap.exists) {
    return { success: false, message: "Bạn đã check-in hôm nay rồi." };
  }

  const now = new Date().toISOString();

  await ref.set({
    docId,
    userId,
    date,
    checkInAt: now,
    checkOutAt: null,
    workSeconds: 0,
    createdAt: now,
    updatedAt: now
  });

  return { success: true, data: { docId } };
};

// USER CHECK-OUT
export const handleCheckOutService = async (userId) => {
  const date = today();
  const docId = `${userId}_${date}`;
  const ref = db.collection("attendance").doc(docId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { success: false, message: "Bạn chưa check-in hôm nay." };
  }

  const record = snap.data();
  if (record.checkOutAt) {
    return { success: false, message: "Bạn đã check-out rồi." };
  }

  const now = new Date().toISOString();
  const seconds =
    (new Date(now).getTime() - new Date(record.checkInAt).getTime()) / 1000;

  await ref.update({
    checkOutAt: now,
    workSeconds: Math.round(seconds),
    updatedAt: now
  });

  return { success: true, data: { docId } };
};

// USER HISTORY (FE hiển thị lịch)
export const fetchHistoryService = async (userId) => {
  const snap = await db
    .collection("attendance")
    .where("userId", "==", userId)
    .get();

  const list = snap.docs.map((d) => {
    const x = d.data();
    return {
      date: x.date,
      checkIn: formatTime(x.checkInAt),
      checkOut: formatTime(x.checkOutAt),
      workMinutes: Math.floor((x.workSeconds || 0) / 60),
      note: x.note || ""
    };
  });

  return list.sort((a, b) => a.date.localeCompare(b.date));
};

// USER SUMMARY (FE dashboard)
export const fetchSummaryService = async (userId) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthKey = `${yyyy}-${mm}`;

  // 1) LẤY TẤT CẢ CA TRONG THÁNG
  const shiftSnap = await db.collection("user_shifts")
    .where("userId", "==", userId)
    .get();

  const monthShifts = shiftSnap.docs
    .map(d => d.data().date)
    .filter(date => date.startsWith(monthKey));

  // Ngày có ca (unique)
  const shiftDays = Array.from(new Set(monthShifts));

  // 2) LẤY ATTENDANCE TRONG THÁNG
  const attSnap = await db.collection("attendance")
    .where("userId", "==", userId)
    .get();

  const attDays = attSnap.docs
    .map(d => d.data().date)
    .filter(date => date.startsWith(monthKey));

  // 3) NGÀY LÀM = ngày có ca VÀ đã check-in
  const worked = shiftDays.filter(day => attDays.includes(day)).length;

  // 4) TÍNH NGÀY NGHỈ
  const daysInMonth = new Date(yyyy, now.getMonth() + 1, 0).getDate();
  const off = shiftDays.length - worked;  // chỉ ngày có ca mới tính nghỉ

  return { 
    daysWorked: worked,     // ngày có ca + có check-in
    daysOff: off            // ngày có ca nhưng không check-in
  };
};


// ADMIN — Lấy toàn bộ attendance
export const adminFetchAllAttendanceService = async () => {
  const snap = await db.collection("attendance").get();

  const list = snap.docs.map((d) => d.data());

  return list.sort((a, b) => a.date.localeCompare(b.date));
};

// ADMIN — lấy 1 doc
export const adminFetchOneAttendanceService = async (docId) => {
  const ref = db.collection("attendance").doc(docId);
  const snap = await ref.get();
  return snap.exists ? snap.data() : null;
};

// ADMIN — cập nhật giờ công (dùng khi admin duyệt request)
export const adminUpdateAttendanceService = async (docId, updates) => {
  const ref = db.collection("attendance").doc(docId);
  const snap = await ref.get();
  if (!snap.exists)
    return { success: false, message: "Attendance không tồn tại" };

  updates.updatedAt = new Date().toISOString();
  await ref.update(updates);

  return { success: true, message: "Cập nhật thành công" };
};
// -----------------------------------------
// CALENDAR SERVICE (LỊCH TỔNG HỢP) 
// -----------------------------------------
export const getUserCalendarService = async (userId, month) => {
  const yearMonth = month; // "YYYY-MM"

  // --------------------
  // 1. Lấy ngày có CA
  // --------------------
  const shiftSnap = await db
    .collection("user_shifts")
    .where("userId", "==", userId)
    .get();

  const shifts = shiftSnap.docs.map((d) => d.data());
  const shiftByDate = {};

  shifts.forEach((s) => {
    if (s.date.startsWith(yearMonth)) {
      shiftByDate[s.date] = {
        shiftId: s.shiftId,
        shiftName: s.shiftName || null, // FE có thể bổ sung
      };
    }
  });

  // -------------------------
  // 2. Attendance theo tháng
  // -------------------------
  const attSnap = await db
    .collection("attendance")
    .where("userId", "==", userId)
    .get();

  const attendance = {};
  attSnap.docs.forEach((d) => {
    const a = d.data();
    if (a.date.startsWith(yearMonth)) {
      attendance[a.date] = a;
    }
  });

  // ------------------------
  // 3. Requests pending
  // ------------------------
  const reqSnap = await db
    .collection("requests")
    .where("userId", "==", userId)
    .get();

  const requests = {};
  reqSnap.docs.forEach((d) => {
    const r = d.data();
    if (r.date.startsWith(yearMonth) && r.status === "pending") {
      requests[r.date] = r;
    }
  });

  // -------------------------
  // 4. Leaves (nghỉ phép)
  // -------------------------
  const leaveSnap = await db
    .collection("leaves")
    .where("userId", "==", userId)
    .get();

  const leaves = {};
  leaveSnap.docs.forEach((d) => {
    const l = d.data();
    if (l.date.startsWith(yearMonth) && l.status === "approved") {
      leaves[l.date] = l;
    }
  });

  // -------------------------
  // 5. Gộp tất cả vào calendar
  // -------------------------
  const result = {};

  Object.keys(shiftByDate).forEach((date) => {
    result[date] = {
      date,
      hasShift: true,
      shift: shiftByDate[date].shiftName || shiftByDate[date].shiftId,
      status: "unknown",
      icon: null,
      checkIn: null,
      checkOut: null,
    };

    // Nếu có nghỉ phép
    if (leaves[date]) {
      result[date].status = "leave-approved";
      result[date].icon = "P";
      return;
    }

    // Nếu có request pending
    if (requests[date]) {
      result[date].status = "pending-request";
      result[date].icon = "!";
      return;
    }

    // Nếu có attendance
    if (attendance[date]) {
      const a = attendance[date];
      const cin = a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;
      const cout = a.checkOutAt ? new Date(a.checkOutAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : null;

      result[date].checkIn = cin;
      result[date].checkOut = cout;

      if (cin && cout) {
        result[date].status = "checked-full";
        result[date].icon = "✓";
      } else {
        result[date].status = "checked-incomplete";
        result[date].icon = "•";
      }
      return;
    }

    // Nếu có ca nhưng không attendance → nghỉ không phép (X)
    result[date].status = "absent";
    result[date].icon = "X";
  });

  return result;
};
