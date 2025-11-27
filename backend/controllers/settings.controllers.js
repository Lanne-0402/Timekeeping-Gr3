import db from "../config/firebase.js";

export const getCompanyLocation = async (req, res) => {
  try {
    const doc = await db.collection("company_settings").doc("default").get();

    if (!doc.exists) {
      return res.json({
        success: true,
        data: { lat: null, lng: null, radius: null },
      });
    }

    return res.json({ success: true, data: doc.data() });
  } catch (err) {
    console.error("Error getCompanyLocation:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateCompanyLocation = async (req, res) => {
  try {
    const { lat, lng, radius } = req.body;

    if (!lat || !lng || !radius) {
      return res.status(400).json({
        success: false,
        message: "Missing lat, lng or radius",
      });
    }

    await db.collection("company_settings").doc("default").set(
      {
        lat,
        lng,
        radius,
      },
      { merge: true }
    );

    return res.json({
      success: true,
      message: "Cập nhật vị trí công ty thành công!",
    });
  } catch (err) {
    console.error("Error updateCompanyLocation:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
