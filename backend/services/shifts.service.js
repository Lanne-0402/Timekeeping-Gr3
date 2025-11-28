import db from "../config/firebase.js";
import admin from "firebase-admin";

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

  const shiftData = {
    id: shiftRef.id,
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

  return snap.docs.map((doc) => doc.data());
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
