// backend/services/face.services.js
import db from "../config/firebase.js";

async function getCompanySettings() {
  const doc = await db.collection("company_settings").doc("default").get();
  return doc.exists ? doc.data() : null;
}

function distanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function euclideanDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

const FACE_THRESHOLD = parseFloat(process.env.FACE_THRESHOLD || "0.6");

export const enrollFaceService = async (userId, embedding) => {
  const now = new Date().toISOString();

  await db.collection("faceEmbeddings").doc(userId).set({
    userId,
    embedding,
    createdAt: now,
    updatedAt: now,
  });
};

export const faceCheckService = async (userId, embedding, lat, lng) => {
  if (!embedding || !Array.isArray(embedding)) {
    return { success: false, message: "Thiếu embedding" };
  }

  const faceDoc = await db.collection("faceEmbeddings").doc(userId).get();
  if (!faceDoc.exists) {
    return { success: false, message: "Chưa đăng ký khuôn mặt" };
  }

  const storedEmbedding = faceDoc.data().embedding;
  const faceDist = euclideanDistance(embedding, storedEmbedding);

  if (faceDist > FACE_THRESHOLD) {
    return { success: false, message: "Khuôn mặt không khớp" };
  }

  if (typeof lat !== "number" || typeof lng !== "number") {
    return { success: false, message: "Thiếu toạ độ GPS" };
  }

  const settings = await getCompanySettings();

  if (!settings) {
    return {
      success: false,
      message:
        "Vị trí công ty chưa được cấu hình trong Admin!",
    };
  }

  const { lat: companyLat, lng: companyLng, radius } = settings;

  if (
    typeof companyLat !== "number" ||
    typeof companyLng !== "number" ||
    typeof radius !== "number"
  ) {
    return {
      success: false,
      message:
        "Dữ liệu vị trí công ty không hợp lệ. Hãy cấu hình lại trong Admin.",
    };
  }

  const gpsDist = distanceInMeters(lat, lng, companyLat, companyLng);

  if (gpsDist > radius) {
    return {
      success: false,
      message: `Bạn đang ngoài khu vực làm việc (cách ${Math.round(
        gpsDist
      )}m, giới hạn ${radius}m).`,
    };
  }

  return {
    success: true,
    faceDist,
    gpsDist,
  };
};
