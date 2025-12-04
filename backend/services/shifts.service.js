import db from "../config/firebase.js";
import admin from "firebase-admin";
import { generateShiftCode } from "../utils/idGenerator.js";

const Timestamp = admin.firestore.Timestamp;

const SHIFTS_COLLECTION = "shifts";
const USER_SHIFTS_COLLECTION = "user_shifts";

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
export const getShiftsService = async () => {
  const snap = await db
    .collection(SHIFTS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  const result = [];

  for (const doc of snap.docs) {
    const shift = doc.data();
    const shiftId = shift.id;

    // ⭐ Lấy danh sách user đã gán vào ca này
    const userShiftsSnap = await db
      .collection(USER_SHIFTS_COLLECTION)
      .where("shiftId", "==", shiftId)
      .get();

    const employeeCount = userShiftsSnap.size;

    result.push({
      ...shift,
      employeeCount,   // ⭐ Trả số lượng nhân viên trong ca
    });
  }

  return result;
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
  // 🔥 Chuẩn hóa ngày trước khi lưu
  // FE có thể gửi "28/11/2025" → đổi về "2025-11-28"
  // ============================
  let finalDate = date;

  if (date.includes("/")) {
    const [dd, mm, yyyy] = date.split("/");
    finalDate = `${yyyy}-${mm}-${dd}`;
  }
  // Nếu đã là yyyy-mm-dd thì giữ nguyên

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
    throw new Error("Thiếu userId / userIds hoặc shiftId / shiftIds");
  }

  const batch = db.batch();
  const col = db.collection(USER_SHIFTS_COLLECTION);
  const result = [];

  uList.forEach((uid) => {
    sList.forEach((sid) => {
      const ref = col.doc();
      const data = {
        id: ref.id,
        userId: uid,
        shiftId: sid,
        date: finalDate,   // 🔥 LƯU DẠNG YYYY-MM-DD CHUẨN
        assignedAt: Timestamp.now(),
      };
      batch.set(ref, data);
      result.push(data);
    });
  });

  await batch.commit();
  return result;
};


/**
 * Lấy ca làm của 1 nhân viên (dùng bên FE nhân viên)
 */
export const getUserShiftsService = async (userId) => {
  if (!userId) throw new Error("Thiếu userId");

  const snap = await db
    .collection(USER_SHIFTS_COLLECTION)
    .where("userId", "==", userId)
    .get();

  const list = snap.docs.map((doc) => doc.data() || {});

  // Sắp xếp theo ngày (mới nhất trước) nhưng làm ở FE/BE bằng JS,
  // tránh phải tạo composite index cho Firestore
  return list.sort((a, b) => {
    const da = a.date || "";
    const dbb = b.date || "";
    return dbb.localeCompare(da); // desc
  });
};
export const getShiftByIdService = async (shiftId) => {
  if (!shiftId) throw new Error("Thiếu ID ca");

  const snap = await db.collection("shifts").doc(shiftId).get();
  if (!snap.exists) throw new Error("Ca không tồn tại");

  return snap.data();
};
export const getEmployeesInShiftService = async (shiftId) => {
  const snap = await db
    .collection("user_shifts")
    .where("shiftId", "==", shiftId)
    .get();

  const list = [];

  for (const doc of snap.docs) {
    const row = doc.data();
    const user = await db.collection("users").doc(row.userId).get();
    list.push({
      id: row.userId,
      name: user.exists ? user.data().name : "Unknown"
    });
  }

  return list;
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
