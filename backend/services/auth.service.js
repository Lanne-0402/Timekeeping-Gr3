// backend/services/auth.service.js
import db from "../config/firebase.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

// =====================
// GMAIL SMTP
// =====================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "timekeepinggr3@gmail.com",      // Gmail bạn
    pass: "wdskjqalhdlhogfs",              // App password 16 kí tự
  },
});

// =====================
const USERS_COLLECTION = "users";
const OTP_COLLECTION = "email_otps";
const REFRESH_COLLECTION = "refresh_tokens";

// =====================
// JWT HELPERS
// =====================
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role || "employee" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role || "employee" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}

// =====================
// SEND OTP VIA GMAIL
// =====================
export const sendOtpService = async (email) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await db.collection(OTP_COLLECTION).doc(email).set({
      email,
      otp,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await transporter.sendMail({
      from: "timekeepinggr3@gmail.com",
      to: email,
      subject: "Mã OTP đăng ký tài khoản",
      html: `<p>Mã OTP của bạn:</p><h2>${otp}</h2><p>Hiệu lực 5 phút.</p>`,
    });

    return { success: true, message: "Đã gửi OTP qua email!" };

  } catch (err) {
    console.error("GMAIL SMTP ERROR:", err);
    return { success: false, message: "Không gửi được OTP" };
  }
};

// =====================
// REGISTER USER
// =====================
export const registerUserService = async ({ name, email, password, role }) => {
  if (!name || !email || !password)
    return { success: false, message: "Thiếu thông tin bắt buộc" };

  const snap = await db.collection(USERS_COLLECTION).where("email", "==", email).get();
  if (!snap.empty)
    return { success: false, message: "Email đã được sử dụng" };

  const hash = await bcrypt.hash(password, 10);
  const userRef = db.collection(USERS_COLLECTION).doc();

  await userRef.set({
    id: userRef.id,
    name,
    email,
    passwordHash: hash,
    role: role || "employee",
    dept: "",
    position: "",
    workStatus: "dang_lam",
    accountStatus: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return { success: true, data: { id: userRef.id } };
};

// =====================
// VERIFY OTP + CREATE USER
// =====================
export const verifyOtpService = async ({ email, otp, name, password }) => {
  if (!email || !otp || !name || !password)
    return { success: false, message: "Thiếu dữ liệu" };

  const ref = db.collection(OTP_COLLECTION).doc(email);
  const otpDoc = await ref.get();

  if (!otpDoc.exists)
    return { success: false, message: "OTP không tồn tại hoặc đã hết hạn" };

  const data = otpDoc.data();

  if (data.otp !== otp)
    return { success: false, message: "OTP không đúng" };

  if (Date.now() > data.expiresAt)
    return { success: false, message: "OTP đã hết hạn" };

  const hash = await bcrypt.hash(password, 10);
  const userRef = db.collection(USERS_COLLECTION).doc();

  await userRef.set({
    id: userRef.id,
    name,
    email,
    passwordHash: hash,
    role: "employee",
    dept: "",
    position: "",
    workStatus: "dang_lam",
    accountStatus: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await ref.delete();

  return { success: true, message: "Đăng ký thành công", data: { id: userRef.id } };
};

// =====================
// LOGIN
// =====================
export const loginUserService = async ({ email, password }) => {
  if (!email || !password)
    return { success: false, message: "Thiếu email hoặc mật khẩu" };

  const snap = await db.collection(USERS_COLLECTION).where("email", "==", email).limit(1).get();

  if (snap.empty)
    return { success: false, message: "Email hoặc mật khẩu không đúng" };

  const user = snap.docs[0].data();

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok)
    return { success: false, message: "Email hoặc mật khẩu không đúng" };

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await db.collection(REFRESH_COLLECTION).doc(user.id).set({
    userId: user.id,
    token: refreshToken,
    createdAt: new Date().toISOString(),
  });

  return { success: true, data: { token: accessToken, refreshToken, user } };
};

// =====================
// REFRESH TOKEN
// =====================
export const refreshTokenService = async (refreshToken) => {
  if (!refreshToken)
    return { success: false, message: "Missing refresh token" };

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return { success: false, message: "Refresh token không hợp lệ" };
  }

  const saved = await db.collection(REFRESH_COLLECTION).doc(decoded.userId).get();
  if (!saved.exists || saved.data().token !== refreshToken)
    return { success: false, message: "Refresh token không được công nhận" };

  const userDoc = await db.collection(USERS_COLLECTION).doc(decoded.userId).get();
  if (!userDoc.exists)
    return { success: false, message: "User không tồn tại" };

  const newAccess = generateAccessToken(userDoc.data());

  return { success: true, data: { accessToken: newAccess } };
};

// =====================
// LOGOUT
// =====================
export const logoutUserService = async (refreshToken) => {
  if (!refreshToken) return { success: true };

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    await db.collection(REFRESH_COLLECTION).doc(decoded.userId).delete();
  } catch {}

  return { success: true };
};

// =====================
// FORGOT PASSWORD
// =====================
export const forgotPasswordService = async (email) => {
  if (!email) return { success: false, message: "Thiếu email" };

  const snap = await db.collection(USERS_COLLECTION).where("email", "==", email).limit(1).get();

  if (snap.empty)
    return { success: false, message: "Email chưa đăng ký" };

  const userDoc = snap.docs[0];
  const newPasswordPlain = crypto.randomBytes(4).toString("hex");

  const hash = await bcrypt.hash(newPasswordPlain, 10);

  await userDoc.ref.update({
    passwordHash: hash,
    updatedAt: new Date().toISOString(),
  });

  console.log("New password for", email, "=", newPasswordPlain);

  return { success: true, message: "Đã tạo mật khẩu mới (xem console)." };
};
