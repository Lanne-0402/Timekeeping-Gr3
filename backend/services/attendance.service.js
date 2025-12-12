import db from "../config/firebase.js";

////////////////////////////////////////////////////
// Helper
////////////////////////////////////////////////////
function today() {
  return new Date().toISOString().split("T")[0];
}

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

////////////////////////////////////////////////////
// CHECK-IN
////////////////////////////////////////////////////
export const handleCheckInService = async (userId) => {
  const date = today();
  const docId = `${userId}_${date}`;
  const ref = db.collection("attendance").doc(docId);
  const snap = await ref.get();

  if (snap.exists) {
    return { success: false, message: "Bạn đã check-in hôm nay rồi." };
  }

  const now = new Date().toISOString();

  // ====== CHẶN CHECK-IN NẾU KHÔNG CÓ CA ======
  const shiftSnap = await db.collection("user_shifts")
    .where("userId", "==", userId)
    .where("date", "==", date)
    .limit(1)
    .get();

  if (shiftSnap.empty) {
    return {
      success: false,
      message: "Hôm nay bạn không có ca làm nên không thể check-in."
    };
  }

const shiftInfo = shiftSnap.docs[0].data();


  await ref.set({
    docId,
    userId,
    date,
    shiftId: shiftInfo?.shiftId || null,
    shiftName: shiftInfo?.shiftName || null,
    checkInAt: now,
    checkOutAt: null,
    workSeconds: 0,
    createdAt: now,
    updatedAt: now
  });

  return { success: true, data: { docId } };
};

////////////////////////////////////////////////////
// CHECK-OUT
////////////////////////////////////////////////////
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
  const seconds = (new Date(now).getTime() - new Date(record.checkInAt).getTime()) / 1000;

  await ref.update({
    checkOutAt: now,
    workSeconds: Math.round(seconds),
    updatedAt: now
  });

  return { success: true, data: { docId } };
};

////////////////////////////////////////////////////
// HISTORY (2 tháng gần nhất)
////////////////////////////////////////////////////
export const fetchHistoryService = async (userId) => {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setMonth(fromDate.getMonth() - 2);

  const from = fromDate.toISOString().split("T")[0];

  const snap = await db.collection("attendance")
    .where("userId", "==", userId)
    .where("date", ">=", from)
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

////////////////////////////////////////////////////
// SUMMARY DASHBOARD (tháng hiện tại)
////////////////////////////////////////////////////
export const fetchSummaryService = async (userId) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthKey = `${yyyy}-${mm}`;

  const shiftSnap = await db.collection("user_shifts")
    .where("userId", "==", userId)
    .where("date", ">=", `${monthKey}-01`)
    .where("date", "<=", `${monthKey}-31`)
    .get();

  const monthShifts = shiftSnap.docs.map((d) => d.data().date);
  const shiftDays = [...new Set(monthShifts)];

  const attSnap = await db.collection("attendance")
    .where("userId", "==", userId)
    .where("date", ">=", `${monthKey}-01`)
    .where("date", "<=", `${monthKey}-31`)
    .get();

  const attDays = attSnap.docs.map((d) => d.data().date);

  const worked = shiftDays.filter((day) => attDays.includes(day)).length;
  const off = shiftDays.length - worked;

  return { daysWorked: worked, daysOff: off };
};

////////////////////////////////////////////////////
// ADMIN — GET ALL
////////////////////////////////////////////////////
export const adminFetchAllAttendanceService = async (from, to) => {
  let query = db.collection("attendance");
  if (from) query = query.where("date", ">=", from);
  if (to) query = query.where("date", "<=", to);

  const snap = await query.get();
  const list = snap.docs.map((d) => d.data());

  return list.sort((a, b) => a.date.localeCompare(b.date));
};

////////////////////////////////////////////////////
// ADMIN — GET ONE
////////////////////////////////////////////////////
export const adminFetchOneAttendanceService = async (docId) => {
  const snap = await db.collection("attendance").doc(docId).get();
  return snap.exists ? snap.data() : null;
};

////////////////////////////////////////////////////
// ADMIN — UPDATE
////////////////////////////////////////////////////
export const adminUpdateAttendanceService = async (docId, updates) => {
  const ref = db.collection("attendance").doc(docId);
  const snap = await ref.get();

  if (!snap.exists) {
    return { success: false, message: "Attendance không tồn tại" };
  }

  updates.updatedAt = new Date().toISOString();
  await ref.update(updates);

  return { success: true, message: "Cập nhật thành công" };
};

////////////////////////////////////////////////////
// CALENDAR — BẢN ĐÃ BỎ REQUESTS + LEAVES
////////////////////////////////////////////////////
export const getUserCalendarService = async (userId, month) => {
  const yearMonth = month; // "YYYY-MM"

  // 1. Shift
  const shiftSnap = await db.collection("user_shifts")
    .where("userId", "==", userId)
    .where("date", ">=", `${yearMonth}-01`)
    .where("date", "<=", `${yearMonth}-31`)
    .get();

  const shifts = shiftSnap.docs.map((d) => d.data());
  const shiftByDate = {};
  shifts.forEach((s) => {
    shiftByDate[s.date] = {
      shiftName: s.shiftName || s.shiftId
    };
  });

  // 2. Attendance
  const attSnap = await db.collection("attendance")
    .where("userId", "==", userId)
    .where("date", ">=", `${yearMonth}-01`)
    .where("date", "<=", `${yearMonth}-31`)
    .get();

  const attendance = {};
  attSnap.docs.forEach((d) => {
    const a = d.data();
    attendance[a.date] = a;
  });

  // 3. Merge calendar
  const result = {};

  Object.keys(shiftByDate).forEach((date) => {
    result[date] = {
      date,
      hasShift: true,
      shift: shiftByDate[date].shiftName,
      status: "unknown",
      icon: null,
      checkIn: null,
      checkOut: null
    };

    if (attendance[date]) {
      const a = attendance[date];
      const cin = a.checkInAt
        ? new Date(a.checkInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        : null;
      const cout = a.checkOutAt
        ? new Date(a.checkOutAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
        : null;

      result[date].checkIn = cin;
      result[date].checkOut = cout;

      if (cin && cout) {
        result[date].status = "checked-full";
        result[date].icon = "✓";
      } else {
        result[date].status = "checked-incomplete";
        result[date].icon = "•";
      }
    } else {
      result[date].status = "absent";
      result[date].icon = "X";
    }
  });

  return result;
};
