import {
  createShiftService,
  getShiftsService,
  assignShiftService,
  getUserShiftsService,
  deleteShiftService,
} from "../services/shifts.service.js";

export const createShift = async (req, res) => {
  try {
    const data = await createShiftService(req.body);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("createShift error:", err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getShifts = async (req, res) => {
  try {
    const data = await getShiftsService();
    return res.json({ success: true, data });
  } catch (err) {
    console.error("getShifts error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const assignShift = async (req, res) => {
  try {
    const data = await assignShiftService(req.body);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("assignShift error:", err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getUserShifts = async (req, res) => {
  try {
    const userId = req.params.userId;
    const data = await getUserShiftsService(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("getUserShifts error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const shiftId = req.params.shiftId;
    await deleteShiftService(shiftId);
    return res.json({
      success: true,
      message: "Đã xoá ca làm.",
    });
  } catch (err) {
    console.error("deleteShift error:", err);
    return res.status(400).json({ success: false, message: err.message });
  }
};
