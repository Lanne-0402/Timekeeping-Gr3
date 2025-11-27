// services/leaves.service.js
import db from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";

const LEAVES_COLLECTION = "leaves";

export const LeavesService = {
  // Tạo đơn nghỉ phép
  async create({ userId, reason, date }) {
    const id = uuidv4();
    const now = new Date();

    const leaveData = {
      id,
      userId,
      reason,
      date,               // "YYYY-MM-DD"
      status: "pending",  // pending | approved | rejected
      adminNote: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(LEAVES_COLLECTION).doc(id).set(leaveData);
    return leaveData;
  },

  // Lấy đơn nghỉ phép theo user
  async getByUser(userId) {
    const snap = await db
      .collection(LEAVES_COLLECTION)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    return snap.docs.map((d) => d.data());
  },

  // Admin: lấy tất cả đơn nghỉ phép
  async getAll() {
    const snap = await db
      .collection(LEAVES_COLLECTION)
      .orderBy("createdAt", "desc")
      .get();

    return snap.docs.map((d) => d.data());
  },

  // Admin: cập nhật trạng thái đơn nghỉ phép
  async updateStatus(leaveId, status, adminId, adminNote) {
    const ref = db.collection(LEAVES_COLLECTION).doc(leaveId);
    const doc = await ref.get();

    if (!doc.exists) throw new Error("Không tìm thấy đơn nghỉ phép");

    const now = new Date();

    await ref.update({
      status,
      adminNote: adminNote || null,
      resolvedBy: adminId || null,
      resolvedAt: now,
      updatedAt: now,
    });

    const updated = await ref.get();
    return updated.data();
  },
};
