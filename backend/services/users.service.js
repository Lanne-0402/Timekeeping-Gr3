// services/users.service.js
import db from "../config/firebase.js";

const USERS_COLLECTION = "users";
const ADMIN_ROLES = ["admin", "System Admin", "manager"];

// Trạng thái làm việc "nghỉ việc" dùng để cho phép xoá
const WORKSTATUS_RESIGNED = "nghi_viec";

export const UsersService = {
  // Lấy danh sách user (ẩn admin/system admin)
  async getUsers() {
    const snap = await db.collection(USERS_COLLECTION).get();
    let users = snap.docs.map((d) => d.data());

    users = users.filter(
      (u) => !["admin", "System Admin"].includes(u.role)
    );

    users.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return users;
  },

  // Lấy 1 user
  async getUserById(userId) {
    if (!userId) return null;
    const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
    if (!doc.exists) return null;
    return doc.data();
  },

  // Cập nhật user (self hoặc admin/manager)
  async updateUser(currentUser, targetUserId, updates) {
    if (!currentUser || !targetUserId) {
      throw new Error("Thiếu thông tin user");
    }

    const ref = db.collection(USERS_COLLECTION).doc(targetUserId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("User không tồn tại");

    const targetUser = snap.data();
    const isAdminLike = ADMIN_ROLES.includes(currentUser.role);
    const isSelf = currentUser.userId === targetUserId;

    const updateData = {};
    const now = new Date().toISOString();

    if (isAdminLike) {
      // Admin / manager có thể sửa các thông tin nhân sự
      const adminAllowedFields = [
        "name",
        "email",
        "dept",
        "position",
        "workStatus",    // đang làm / nghỉ phép / nghỉ việc...
        "accountStatus", // active / inactive
      ];

      for (const key of adminAllowedFields) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
          updateData[key] = updates[key];
        }
      }
    } else if (isSelf) {
      // Nhân viên tự sửa mình -> giới hạn
      const selfAllowedFields = [
        "name",
        // "email",      // nếu sau này muốn cho sửa email thì mở dòng này
        // "avatarUrl",  // nếu có lưu avatar trong users
      ];

      for (const key of selfAllowedFields) {
        if (Object.prototype.hasOwnProperty.call(updates, key)) {
          updateData[key] = updates[key];
        }
      }
    } else {
      // Không phải self, không phải admin/manager
      throw new Error("Không có quyền cập nhật user này");
    }

    // Không cho phép sửa các trường nguy hiểm
    delete updateData.id;
    delete updateData.role;
    delete updateData.userId;

    if (Object.keys(updateData).length === 0) {
      throw new Error("Không có trường hợp lệ để cập nhật");
    }

    updateData.updatedAt = now;

    await ref.update(updateData);

    const updatedDoc = await ref.get();
    return updatedDoc.data();
  },

  // Xoá user (chỉ khi đã nghỉ việc) + xoá sạch dữ liệu liên quan
  async deleteUser(userId) {
    if (!userId) throw new Error("Thiếu userId");

    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new Error("User không tồn tại");
    }

    const user = userSnap.data();

    if (user.workStatus !== WORKSTATUS_RESIGNED) {
      throw new Error("Chỉ được xoá nhân viên đã nghỉ việc");
    }

    // Xoá user
    await userRef.delete();

    // Xoá FaceID
    try {
      await db.collection("faceEmbeddings").doc(userId).delete();
    } catch (_) {}

    // Xoá attendance
    try {
      const attSnap = await db
        .collection("attendance")
        .where("userId", "==", userId)
        .get();
      const batch = db.batch();
      attSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (_) {}

    // Xoá gán ca (user_shifts)
    try {
      const usSnap = await db
        .collection("user_shifts")
        .where("userId", "==", userId)
        .get();
      const batch = db.batch();
      usSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (_) {}

    // Xoá requests
    try {
      const reqSnap = await db
        .collection("requests")
        .where("userId", "==", userId)
        .get();
      const batch = db.batch();
      reqSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (_) {}

    // Xoá leaves (đơn xin nghỉ)
    try {
      const leaveSnap = await db
        .collection("leaves")
        .where("userId", "==", userId)
        .get();
      const batch = db.batch();
      leaveSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (_) {}

    // Xoá refresh token
    try {
      await db.collection("refresh_tokens").doc(userId).delete();
    } catch (_) {}

    return true;
  },

  // (Giữ lại helper nếu cần dùng nơi khác)
  async getUserByEmail(email) {
    const snap = await db
      .collection(USERS_COLLECTION)
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0].data();
  },
};
