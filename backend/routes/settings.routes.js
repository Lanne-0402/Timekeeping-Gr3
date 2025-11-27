// routes/settings.routes.js
import express from "express";
import  adminOnly from "../middleware/admin.middleware.js";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  getCompanyLocation,
  updateCompanyLocation,
} from "../controllers/settings.controllers.js";

const router = express.Router();

// cần authMiddleware để gắn req.user trước rồi mới adminOnly
router.get("/location", authMiddleware, adminOnly, getCompanyLocation);
router.post("/location", authMiddleware, adminOnly, updateCompanyLocation);

export default router;
