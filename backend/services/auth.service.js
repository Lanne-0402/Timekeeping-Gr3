// backend/services/auth.service.js
import db from "../config/firebase.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import axios from "axios";

// =====================
// SEND EMAIL WITH BREVO API
// =====================
async function sendBrevoEmail(to, subject, html) {
  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { email: process.env.SENDER_EMAIL, name: "Timekeeping" },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          accept: "application/json",
          "content-type": "application/json",
        },
      }
    );

    return true;
  } catch (err) {
    console.error("BREVO API ERROR:", err.response?.data || err);
    return false;
  }
}

const USERS_COLLECTION = "users";
const OTP_COLLECTION = "email_otps";
const REFRESH_COLLECTION = "refresh_tokens";

const ACCESS_TOKEN_EXPIRES_IN = "1h";
const REFRESH_TOKEN_EXPIRES_IN_DAYS = 7;

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role || "employee" },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role || "employee" },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_TOKEN_EXPIRES_IN_DAYS}d` }
  );
}

// ======================================================
// REGISTER USER
// ======================================================
export const registerUserService = async ({ name, email, password, role }) => {
  if (!name || !email || !password) {
    return { success: false, message: "Thiếu thông tin bắt buộc" };
  }

  const snap = await db
    .collection(USERS_COLLECTION)
    .where("email", "==", email)
    .get();
  if (!snap.empty) {
    return { success: false, message: "Email đã được sử dụng" };
  }

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

// ======================================================
// SEND OTP (BREVO VERSION - FAST & RELIABLE)
// ======================================================
export const sendOtpService = async (email) => {
  if (!email) return { success: false, message: "Thiếu email" };

  const exists = await db
    .collection(USERS_COLLECTION)
    .where("email", "==", email)
    .get();

  if (!exists.empty) {
    return { success: false, message: "Email đã được đăng ký" };
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 10 * 60 * 1000;

  await db.collection(OTP_COLLECTION).doc(email).set({
    email,
    otp,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  const sent = await sendBrevoEmail(
    email,
    "Mã xác thực đăng ký tài khoản",
    `
      <h2>Xác thực email</h2>
      <p>Mã OTP của bạn là:</p>
      <h1 style="font-size: 32px; letter-spacing: 3px">${otp}</h1>
      <p>Mã có hiệu lực trong 10 phút.</p>
      <br/>
      <p>Timekeeping System</p>
    `
  );

  if (!sent) {
    return {
      success: false,
      message: "Không gửi được email OTP. Vui lòng thử lại sau.",
    };
  }

  return { success: true, message: "Đã gửi OTP tới email của bạn." };
};

// ======================================================
// VERIFY OTP
// ======================================================
export const verifyOtpService = async ({ email, otp, name, password }) => {
  if (!email || !otp || !name || !password) {
    return { success: false, message: "Thiếu dữ liệu" };
  }

  const otpDoc = await db.collection(OTP_COLLECTION).doc(email).get();
  if (!otpDoc.exists) {
    return { success: false, message: "OTP không tồn tại hoặc đã hết hạn" };
  }

  const data = otpDoc.data();

  if (data.otp !== otp) {
    return { success: false, message: "OTP không đúng" };
  }

  if (Date.now() > data.expiresAt) {
    return { success: false, message: "OTP đã hết hạn" };
  }

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

  await otpDoc.ref.delete();

  return {
    success: true,
    message: "Xác thực email & tạo tài khoản thành công",
    data: { id: userRef.id },
  };
};

// ======================================================
// LOGIN
// ======================================================
export const loginUserService = async ({ email, password }) => {
  if (!email || !password)
    return { success: false, message: "Thiếu email hoặc mật khẩu" };

  const snap = await db
    .collection(USERS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) {
    return { success: false, message: "Email hoặc mật khẩu không đúng" };
  }

  const user = snap.docs[0].data();

  const ok = await bcrypt.compare(password, user.passwordHash || "");
  if (!ok) {
    return { success: false, message: "Email hoặc mật khẩu không đúng" };
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await db.collection(REFRESH_COLLECTION).doc(user.id).set({
    userId: user.id,
    token: refreshToken,
    createdAt: new Date().toISOString(),
  });

  return {
    success: true,
    data: {
      token: accessToken,
      refreshToken,
      user,
    },
  };
};

// ======================================================
// REFRESH TOKEN
// ======================================================
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
  if (!saved.exists || saved.data().token !== refreshToken) {
    return { success: false, message: "Refresh token không được công nhận" };
  }

  const userDoc = await db.collection(USERS_COLLECTION).doc(decoded.userId).get();
  if (!userDoc.exists) {
    return { success: false, message: "User không tồn tại" };
  }

  const newAccess = generateAccessToken(userDoc.data());

  return { success: true, data: { accessToken: newAccess } };
};

// ======================================================
// LOGOUT
// ======================================================
export const logoutUserService = async (refreshToken) => {
  if (!refreshToken) return { success: true };

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    await db.collection(REFRESH_COLLECTION).doc(decoded.userId).delete();
  } catch {}

  return { success: true };
};

// ======================================================
// FORGOT PASSWORD
// ======================================================
export const forgotPasswordService = async (email) => {
  if (!email) return { success: false, message: "Thiếu email" };

  const snap = await db
    .collection(USERS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) {
    return { success: false, message: "Email chưa đăng ký" };
  }

  const userDoc = snap.docs[0];
  const newPasswordPlain = crypto.randomBytes(4).toString("hex");

  const hash = await bcrypt.hash(newPasswordPlain, 10);

  await userDoc.ref.update({
    passwordHash: hash,
    updatedAt: new Date().toISOString(),
  });

  console.log("New password for", email, "=", newPasswordPlain);

  return {
    success: true,
    message: "Đã tạo mật khẩu mới (xem console).",
  };
};
