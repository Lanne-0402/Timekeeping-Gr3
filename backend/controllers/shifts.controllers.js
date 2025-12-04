import {
  createShiftService,
  getShiftsService,
  assignShiftService,
  getUserShiftsService,
  deleteShiftService,
  getShiftByIdService,
  getEmployeesInShiftService,
  updateShiftService,
  addEmployeeToShiftService,
  removeEmployeeFromShiftService
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
export const getShiftById = async (req, res) => {
  try {
    const shiftId = req.params.shiftId;
    const data = await getShiftByIdService(shiftId);

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
export const getEmployeesInShift = async (req, res) => {
  try {
    const shiftId = req.params.shiftId;
    const data = await getEmployeesInShiftService(shiftId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
export const updateShift = async (req, res) => {
  try {
    const shiftId = req.params.shiftId;
    const updated = await updateShiftService(shiftId, req.body);
    return res.json({ success: true, message: "Đã cập nhật ca làm." });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
export const addEmployeeToShift = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { userId } = req.body;

    await addEmployeeToShiftService(shiftId, userId);

    return res.json({
      success: true,
      message: "Đã thêm nhân viên vào ca."
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
export const removeEmployeeFromShift = async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { userId } = req.body;

    await removeEmployeeFromShiftService(shiftId, userId);

    return res.json({
      success: true,
      message: "Đã xoá nhân viên khỏi ca."
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
