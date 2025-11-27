// services/requests.service.js
import db from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";

const REQUESTS_COLLECTION = "requests";
const ATTENDANCE_COLLECTION = "attendance";

export const RequestsService = {
  // ----- Tạo yêu cầu mới từ nhân viên -----
  async create(userId, payload) {
    const { type, date, shift, cin, cout, note } = payload || {};

    if (!date) {
      throw new Error("Vui lòng chọn ngày.");
    }

    const reqType = type || "chinh-sua"; // mặc định là chỉnh sửa
    const now = new Date();
    const id = uuidv4();

    const data = {
      id,
      userId,
      type: reqType,           // 'chinh-sua' | 'khieu-nai' | ...
      date,                    // 'YYYY-MM-DD'
      shift: shift || null,    // tên ca hoặc id ca, tuỳ FE
      cin: cin || null,        // giờ check-in đề nghị (HH:MM)
      cout: cout || null,      // giờ check-out đề nghị
      note: note || "",
      status: "pending",       // pending | approved | rejected
      adminNote: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection(REQUESTS_COLLECTION).doc(id).set(data);
    return data;
  },

  // ----- Lấy yêu cầu theo user -----
    async getByUser(userId) {
    if (!userId) throw new Error("Thiếu userId");

    const snap = await db
      .collection(REQUESTS_COLLECTION)
      .where("userId", "==", userId)
      .get();

    const list = snap.docs.map((d) => d.data() || {});

    // Sắp xếp mới nhất trước, làm bằng JS để khỏi cần index
    return list.sort((a, b) => {
      const ca = a.createdAt || "";
      const cb = b.createdAt || "";
      return cb.localeCompare(ca); // desc
    });
  },

  // ----- Lấy toàn bộ yêu cầu (admin) -----
  async getAll() {
    const snap = await db
      .collection(REQUESTS_COLLECTION)
      .orderBy("createdAt", "desc")
      .get();
    return snap.docs.map((d) => d.data());
  },

  // ----- Admin duyệt / từ chối yêu cầu -----
  async updateStatus(requestId, status, adminId, adminNote) {
    if (!requestId) throw new Error("Thiếu requestId");
    if (!status || !["approved", "rejected"].includes(status)) {
      throw new Error("Trạng thái không hợp lệ");
    }

    const ref = db.collection(REQUESTS_COLLECTION).doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new Error("Yêu cầu không tồn tại");
    }

    const req = snap.data();

    // Nếu đã xử lý rồi thì không cho đổi nữa
    if (req.status !== "pending") {
      throw new Error("Yêu cầu đã được xử lý trước đó");
    }

    const now = new Date();

    const updateData = {
      status,
      adminNote: adminNote || null,
      resolvedBy: adminId,
      resolvedAt: now,
      updatedAt: now,
    };

    // Nếu Approved + type = 'chinh-sua' + có đủ date + cin + cout => cập nhật attendance
    if (
      status === "approved" &&
      req.type === "chinh-sua" &&
      req.date &&
      req.cin &&
      req.cout
    ) {
      await this._applyAttendanceEdit(req);
    }

    await ref.update(updateData);

    const updated = (await ref.get()).data();
    return updated;
  },

  // ----- Nội bộ: áp dụng chỉnh sửa công vào bảng attendance -----
  async _applyAttendanceEdit(req) {
    const { userId, date, cin, cout, note } = req;
    if (!userId || !date || !cin || !cout) return;

    const docId = `${userId}_${date}`;
    const ref = db.collection(ATTENDANCE_COLLECTION).doc(docId);
    const snap = await ref.get();

    // Ghép giờ vào ngày → Date
    const checkInDate = new Date(`${date}T${cin}:00`);
    const checkOutDate = new Date(`${date}T${cout}:00`);

    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      throw new Error("Giờ vào/ra không hợp lệ");
    }

    const workSeconds = Math.max(
      0,
      Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 1000)
    );
    const now = new Date();

    const baseData = {
      docId,
      userId,
      date,
      checkInAt: checkInDate.toISOString(),
      checkOutAt: checkOutDate.toISOString(),
      workSeconds,
      note: note || "",
      updatedAt: now.toISOString(),
    };

    if (!snap.exists) {
      // Nếu chưa có record thì tạo mới
      await ref.set({
        ...baseData,
        createdAt: now.toISOString(),
      });
    } else {
      // Nếu đã có thì cập nhật
      await ref.update(baseData);
    }
  },
};
