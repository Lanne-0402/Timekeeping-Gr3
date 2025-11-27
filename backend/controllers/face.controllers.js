// backend/controllers/face.controllers.js
import {
  enrollFaceService,
  faceCheckService,
} from "../services/face.services.js";
import {
  handleCheckInService,
  handleCheckOutService,
} from "../services/attendance.service.js";

export const enrollFace = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { embedding } = req.body;

    if (!embedding || !Array.isArray(embedding)) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu dữ liệu FaceID" });
    }

    await enrollFaceService(userId, embedding);

    return res.json({
      success: true,
      message: "Đăng ký FaceID thành công",
    });
  } catch (err) {
    console.error("enrollFace error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error khi đăng ký FaceID",
    });
  }
};

export const faceCheckIn = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { embedding, lat, lng } = req.body;

    const faceResult = await faceCheckService(userId, embedding, lat, lng);
    if (!faceResult.success) {
      return res.status(400).json({
        success: false,
        message: faceResult.message || "FaceID hoặc vị trí không hợp lệ",
      });
    }

    const attResult = await handleCheckInService(userId);
    if (!attResult.success) {
      return res.status(400).json(attResult);
    }

    return res.json({
      success: true,
      message: "Check-in FaceID thành công",
      data: {
        ...attResult.data,
        faceDist: faceResult.faceDist,
        gpsDist: faceResult.gpsDist,
      },
    });
  } catch (err) {
    console.error("faceCheckIn error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error khi check-in",
    });
  }
};

export const faceCheckOut = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { embedding, lat, lng } = req.body;

    const faceResult = await faceCheckService(userId, embedding, lat, lng);
    if (!faceResult.success) {
      return res.status(400).json({
        success: false,
        message: faceResult.message || "FaceID hoặc vị trí không hợp lệ",
      });
    }

    const attResult = await handleCheckOutService(userId);
    if (!attResult.success) {
      return res.status(400).json(attResult);
    }

    return res.json({
      success: true,
      message: "Check-out FaceID thành công",
      data: {
        ...attResult.data,
        faceDist: faceResult.faceDist,
        gpsDist: faceResult.gpsDist,
      },
    });
  } catch (err) {
    console.error("faceCheckOut error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error khi check-out",
    });
  }
};
