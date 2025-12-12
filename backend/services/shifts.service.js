const SHIFTS_COLLECTION = "shifts";
const USER_SHIFTS_COLLECTION = "user_shifts";
import db from "../config/firebase.js";
import admin from "firebase-admin";
import { generateShiftCode } from "../utils/idGenerator.js";

const Timestamp = admin.firestore.Timestamp;


export const createShiftService = async (payload = {}) => {
  const { date, name, startTime, endTime } = payload;

  // Bắt buộc phải có giờ
  if (!startTime || !endTime) {
    throw new Error("Thiếu giờ bắt đầu hoặc kết thúc");
  }

  // Tự generate name nếu FE không gửi
  let finalName = (name || "").trim();

  if (!finalName) {
    if (date) {
      finalName = `Ca ngày ${date} (${startTime}-${endTime})`;
    } else {
      finalName = `Ca (${startTime}-${endTime})`;
    }
  }

  const shiftRef = db.collection(SHIFTS_COLLECTION).doc();

  // Mã ca làm thân thiện
  const shiftCode = await generateShiftCode();

  const shiftData = {
    id: shiftRef.id,          // vẫn giữ ID random
    shiftCode,                // VD: CA001
    name: finalName,
    startTime,
    endTime,
    createdAt: Timestamp.now(),
  };


  // Nếu có ngày thì lưu luôn
  if (date) shiftData.date = date;

  await shiftRef.set(shiftData);
  return shiftData;
};

/**
 * Lấy danh sách ca làm
 */
export const getShiftsService = async (month) => {
  // Nếu không có month thì lấy tháng hiện tại
  let year, mon;
  if (month && month.includes("-")) {
    [year, mon] = month.split("-");
  } else {
    const today = new Date();
    year = today.getFullYear();
    mon = today.getMonth() + 1;
  }

  const fromDate = `${year}-${String(mon).padStart(2, "0")}-01`;
  const toDateObj = new Date(year, mon, 0); 
  const toDate = toDateObj.toISOString().split("T")[0];

  // 1️⃣ Lấy shift theo tháng yêu cầu
  const shiftSnap = await db.collection("shifts")
    .where("date", ">=", fromDate)
    .where("date", "<=", toDate)
    .orderBy("date", "asc")
    .get();

  const shifts = shiftSnap.docs.map(d => d.data());
  if (shifts.length === 0) return [];

  // 2️⃣ Lấy user_shifts tương ứng (1 query)
  const userShiftSnap = await db.collection("user_shifts")
    .where("date", ">=", fromDate)
    .where("date", "<=", toDate)
    .get();

  const countMap = {};
  userShiftSnap.docs.forEach((doc) => {
    const us = doc.data();
    countMap[us.shiftId] = (countMap[us.shiftId] || 0) + 1;
  });

  // 3️⃣ Gộp số người trong ca
  return shifts.map((s) => ({
    ...s,
    employeeCount: countMap[s.id] || 0,
  }));
};


/**
 * Xóa ca làm
 */
export const deleteShiftService = async (id) => {
  if (!id) throw new Error("Thiếu ID ca làm");

  await db.collection(SHIFTS_COLLECTION).doc(id).delete();
  return true;
};

/**
 * Gán ca cho (nhiều) nhân viên
 * Body mới hỗ trợ:
 *   { userIds: [], shiftIds: [], date }
 * hoặc tương thích cũ:
 *   { userId, shiftId, date }
 */
export const assignShiftService = async (payload = {}) => {
  const { userId, shiftId, userIds, shiftIds, date } = payload;

  if (!date) {
    throw new Error("Thiếu ngày gán ca");
  }

  // ============================
  // 🔥 Chuẩn hoá format ngày
  // ============================
  let finalDate = date;
  if (date.includes("/")) {
    const [dd, mm, yyyy] = date.split("/");
    finalDate = `${yyyy}-${mm}-${dd}`;
  }

  // ============================
  // 🔥 Danh sách user + shift
  // ============================
  const uList = Array.isArray(userIds)
    ? userIds
    : userId
    ? [userId]
    : [];

  const sList = Array.isArray(shiftIds)
    ? shiftIds
    : shiftId
    ? [shiftId]
    : [];

  if (!uList.length || !sList.length) {
    throw new Error("Thiếu userId / shiftId");
  }

  // ❌ Không cho 1 ngày gán nhiều ca
  if (sList.length > 1) {
    throw new Error("Mỗi ngày chỉ được gán 1 ca làm duy nhất");
  }

  const selectedShiftId = sList[0];

  // ============================
  // 🔥 Kiểm tra cho từng nhân viên
  // ============================
  for (const uid of uList) {
    const existing = await db.collection("user_shifts")
      .where("userId", "==", uid)
      .where("date", "==", finalDate)
      .get();

    if (!existing.empty) {
      throw new Error(`Nhân viên đã có ca trong ngày ${finalDate}`);
    }
  }

  // ============================
  // 🔥 Ghi vào DB
  // ============================
  const batch = db.batch();
  const col = db.collection(USER_SHIFTS_COLLECTION);
  const result = [];

  uList.forEach((uid) => {
    const ref = col.doc();
    const data = {
      id: ref.id,
      userId: uid,
      shiftId: selectedShiftId,
      date: finalDate,
      assignedAt: Timestamp.now(),
    };
    batch.set(ref, data);
    result.push(data);
  });

  await batch.commit();

  return result;
};

/**
 * Lấy ca làm của 1 nhân viên (dùng bên FE nhân viên)
 */
export const getUserShiftsService = async (userId, month) => {
  // month dạng "2025-11" hoặc undefined
  const snap = await db
    .collection(USER_SHIFTS_COLLECTION)
    .where("userId", "==", userId)
    .get();

  if (snap.empty) return [];

  const result = [];
  const monthKey = month?.trim(); // "2025-11"

  for (const doc of snap.docs) {
    const us = doc.data();

    // Chuẩn hoá ngày: "dd/mm/yyyy" -> "yyyy-mm-dd"
    let d = (us.date || "").trim();
    if (!d) continue;

    if (d.includes("/")) {
      const [dd, mm, yyyy] = d.split("/");
      d = `${yyyy}-${mm}-${dd}`;
    }

    // Nếu có truyền month thì chỉ lấy đúng tháng đó
    if (monthKey && !d.startsWith(monthKey)) {
      continue;
    }

    const shiftSnap = await db
      .collection(SHIFTS_COLLECTION)
      .doc(us.shiftId)
      .get();
    if (!shiftSnap.exists) continue;

    result.push({
      id: doc.id,
      userId: us.userId,
      shiftId: us.shiftId,
      date: d, // đã chuẩn hoá "yyyy-mm-dd"
      assignedAt: us.assignedAt,
      ...(shiftSnap.data() || {}),
    });
  }

  return result;
};

export const getShiftByIdService = async (shiftId) => {
  if (!shiftId) throw new Error("Thiếu ID ca");

  const snap = await db.collection("shifts").doc(shiftId).get();
  if (!snap.exists) throw new Error("Ca không tồn tại");

  return snap.data();
};
export const getEmployeesInShiftService = async (shiftId) => {
  if (!shiftId) throw new Error("Thiếu shiftId");

  // 1️⃣ Lấy user_shifts của ca
  const snap = await db.collection("user_shifts")
    .where("shiftId", "==", shiftId)
    .get();

  const records = snap.docs.map(d => d.data());
  if (records.length === 0) return [];

  const userIds = records.map(r => r.userId);

  // 2️⃣ Lấy thông tin users bằng IN query
  const userSnap = await db.collection("users")
    .where("id", "in", userIds)
    .get();

  const userMap = {};
  userSnap.docs.forEach(u => userMap[u.id] = u.data());

  // 3️⃣ Trả dữ liệu đầy đủ
  return records.map(r => {
    const u = userMap[r.userId] || {};
    return {
      id: r.userId,
      name: u.name || "Unknown",
      employeeCode: u.employeeCode || "N/A"   // ⭐ FIX QUAN TRỌNG
    };
  });
};


export const updateShiftService = async (shiftId, payload) => {
  const { date, startTime, endTime, name } = payload;

  const updateData = {};

  if (date) updateData.date = date;
  if (startTime) updateData.startTime = startTime;
  if (endTime) updateData.endTime = endTime;
  if (name) updateData.name = name;

  await db.collection("shifts").doc(shiftId).update(updateData);

  return true;
};
export const addEmployeeToShiftService = async (shiftId, userId) => {
  if (!shiftId || !userId) {
    throw new Error("Thiếu shiftId hoặc userId");
  }

  // Lấy thông tin ca để biết ngày
  const shiftDoc = await db.collection("shifts").doc(shiftId).get();
  if (!shiftDoc.exists) throw new Error("Ca không tồn tại");

  const shift = shiftDoc.data();

  // Kiểm tra nhân viên đã có trong ca chưa
  const snap = await db.collection("user_shifts")
    .where("shiftId", "==", shiftId)
    .where("userId", "==", userId)
    .get();

  if (!snap.empty) {
    throw new Error("Nhân viên đã được gán vào ca này rồi");
  }

  // Tạo record mới
  const ref = db.collection("user_shifts").doc();
  await ref.set({
    id: ref.id,
    shiftId,
    userId,
    date: shift.date, // dùng date của ca
    assignedAt: Timestamp.now(),
  });

  return true;
};
export const removeEmployeeFromShiftService = async (shiftId, userId) => {
  if (!shiftId || !userId) {
    throw new Error("Thiếu shiftId hoặc userId");
  }

  const snap = await db.collection("user_shifts")
    .where("shiftId", "==", shiftId)
    .where("userId", "==", userId)
    .get();

  if (snap.empty) {
    throw new Error("Nhân viên không tồn tại trong ca này");
  }

  const batch = db.batch();

  snap.forEach(doc => batch.delete(doc.ref));

  await batch.commit();

  return true;
};
