// createAdmin.js
import bcrypt from "bcryptjs";
import db from "../config/firebase.js";
import { v4 as uuidv4 } from "uuid";

async function createAdmin() {
  try {
    const adminEmail = "admin@timekeeping.com";
    const adminPassword = "admin123";

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    // Generate unique ID
    const adminId = uuidv4();

    const adminData = {
      id: adminId,
      name: "System Admin",
      email: adminEmail,
      role: "admin",
      dept: "Management",
      position: "Administrator",
      status: "active",
      isVerified: true,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save vào Firestore
    await db.collection("users").doc(adminId).set(adminData);

    console.log("⭐ Admin created successfully!");
    console.log("Email:", adminEmail);
    console.log("Password:", adminPassword);
    console.log("User ID:", adminId);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin:", error);
    process.exit(1);
  }
}

createAdmin();
