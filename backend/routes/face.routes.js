import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import {
  enrollFace,
  faceCheckIn,
  faceCheckOut,
} from "../controllers/face.controllers.js";

const router = express.Router();

router.post("/enroll", authMiddleware, enrollFace);
router.post("/check-in", authMiddleware, faceCheckIn);
router.post("/check-out", authMiddleware, faceCheckOut);

export default router;
