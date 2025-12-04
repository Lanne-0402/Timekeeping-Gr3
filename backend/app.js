import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authMiddleware from "./middleware/auth.middleware.js";
import adminOnly from "./middleware/admin.middleware.js";  

dotenv.config();

// Import routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/users.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import shiftsRoutes from "./routes/shifts.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import faceRoutes from "./routes/face.routes.js";
import settingsRoutes from "./routes/settings.routes.js";

const app = express();




app.use(express.json());
// CORS FIX for Vite + all HTTP methods
app.use(cors({
  origin: [ "http://localhost:5000",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:5173",
            "http://127.0.0.1:5173"], 
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// allow OPTIONS preflight
app.options("*", cors());

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Timekeeping API is running" });
});

// Public routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// Protected routes
app.use("/api/attendance", authMiddleware, attendanceRoutes);
app.use("/api/shifts", authMiddleware, shiftsRoutes);
app.use("/api/reports", authMiddleware, reportsRoutes);
app.use("/api/face", faceRoutes);
app.use("/api/settings", settingsRoutes);

// 404 fallback
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

export default app;
