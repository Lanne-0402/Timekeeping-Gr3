// backend/services/auth.service.js
import db from "../config/firebase.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { generateEmployeeCode } from "../utils/idGenerator.js";

// =====================
// GMAIL SMTP
// =====================

// Import thư viện Mailjet
import Mailjet from 'node-mailjet';
import dotenv from 'dotenv';
dotenv.config();

// Kết nối với Mailjet
const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE
);

const sendEmail = async (email, subject, text) => {
    try {
        const request = mailjet
            .post("send", { 'version': 'v3.1' })
            .request({
                Messages: [
                    {
                        From: {
                            Email: process.env.SENDER_EMAIL,
                            Name: "Timekeeping App Gr3"
                        },
                        To: [
                            {
                                Email: email,
                                Name: "Employee"
                            }
                        ],
                        Subject: subject,
                        // Bạn có thể dùng HTMLPart để trang trí mail đẹp hơn
                        HTMLPart: `<h3>${subject}</h3><p>${text}</p>`, 
                        TextPart: text
                    }
                ]
            });

        const result = await request;
        console.log("✅ Mailjet sent successfully:", result.body);
        return result.body;

    } catch (error) {
        console.error("❌ Mailjet Error:", error.statusCode, error.message);
        // Lưu ý: Mailjet trả lỗi khá chi tiết, hãy xem log để biết tại sao
        throw error; 
    }
};

export default sendEmail;


/** const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 2525,                 // Đổi sang cổng 587
  secure: false,             // Bắt buộc để false khi dùng cổng 587
  auth: {
    user: process.env.SENDER_EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false // Thêm dòng này để tránh lỗi chứng chỉ SSL trên Render
  }
}); **/

/**  Import axios (nhớ cài đặt: npm install axios)
import axios from 'axios'; 

// Hàm gửi mail mới
const sendEmail = async (email, subject, text) => {
  try {
    const data = {
      sender: { name: "Timekeeping App", email: process.env.SENDER_EMAIL }, // Email sender đã verify trong Brevo
      to: [{ email: email }],
      subject: subject,
      htmlContent: `<p>${text}</p>` // Hoặc truyền HTML đẹp hơn vào đây
    };

    const config = {
      headers: {
        'accept': 'application/json',
        'api-key': process.env.BREVO_API_KEY, // Biến môi trường mới
        'content-type': 'application/json'
      }
    };

    // Gọi API của Brevo (Chạy qua cổng 443 - Render không chặn)
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', data, config);
    
    console.log("✅ Email sent successfully via Brevo API");
    return response.data;

  } catch (error) {
    console.error("❌ Send Email Error:", error.response ? error.response.data : error.message);
    // Không throw error để tránh crash app, hoặc xử lý tùy logic của bạn
  }
};

export default sendEmail; **/

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

  const snap = await db.collection(USERS_COLLECTION)
    .where("email", "==", email)
    .get();

  if (!snap.empty)
    return { success: false, message: "Email đã được sử dụng" };

  // Hash password
  const hash = await bcrypt.hash(password, 10);

  // Tạo mã NV001, NV002...
  const employeeCode = await generateEmployeeCode();

  // Document id random (giữ để tránh phá hệ thống)
  const userRef = db.collection(USERS_COLLECTION).doc();
  
  await userRef.set({
    id: userRef.id,               // ID thật (random) – dùng để join
    employeeCode,                 // MÃ NV GỌN: “NV001”
    name,
    email,
    passwordHash: hash,
    role: "user",
    dept: "",
    position: "employee",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    success: true,
    data: {
      id: userRef.id,
      employeeCode,
    }
  };
};

// =====================
// VERIFY OTP + CREATE USER
// =====================
export const verifyOtpService = async ({ email, otp, name, password }) => {
  // 0. Kiểm tra dữ liệu
  if (!email || !otp || !name || !password) {
    return { success: false, message: "Thiếu dữ liệu" };
  }

  // 1. Lấy OTP từ collection dùng chung
  const ref = db.collection(OTP_COLLECTION).doc(email);
  const otpDoc = await ref.get();

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

  // 2. Tạo mã nhân viên NV001, NV002...
  const employeeCode = await generateEmployeeCode();

  // 3. Hash mật khẩu
  const hash = await bcrypt.hash(password, 10);

  // 4. Tạo user mới
  const userRef = db.collection(USERS_COLLECTION).doc();

  await userRef.set({
    id: userRef.id,          // ID thật (random)
    employeeCode,            // NV001, NV002...
    name,
    email,
    passwordHash: hash,
    role: "user",
    dept: "",
    position: "employee",
    status: "active",
    workStatus: "dang_lam",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 5. Xoá OTP sau khi dùng
  await ref.delete();

  return {
    success: true,
    message: "Đăng ký thành công",
    data: {
      id: userRef.id,
      employeeCode,
    },
  };
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

  // Kiểm tra email đã có user chưa
  const snap = await db
    .collection(USERS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) {
    return { success: false, message: "Email chưa đăng ký" };
  }

  // Tạo OTP mới
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Lưu OTP vào collection dùng chung với đăng ký
  await db.collection(OTP_COLLECTION).doc(email).set({
    email,
    otp,
    purpose: "reset",             // phân biệt với đăng ký nếu cần
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 phút
  });

  // Gửi OTP qua Gmail SMTP (transporter đã cấu hình sẵn)
  await transporter.sendMail({
    from: "timekeepinggr3@gmail.com",
    to: email,
    subject: "Mã OTP đặt lại mật khẩu",
    html: `
      <p>Mã OTP đặt lại mật khẩu của bạn là:</p>
      <h2>${otp}</h2>
      <p>Mã có hiệu lực trong 5 phút.</p>
    `,
  });

  return { success: true, message: "Đã gửi OTP qua email!" };
};
export const checkResetOtpService = async ({ email, otp }) => {
  if (!email || !otp)
    return { success: false, message: "Thiếu dữ liệu" };

  const ref = db.collection(OTP_COLLECTION).doc(email);
  const doc = await ref.get();

  if (!doc.exists)
    return { success: false, message: "OTP không tồn tại hoặc đã hết hạn" };

  const data = doc.data();

  if (data.otp !== otp)
    return { success: false, message: "OTP không đúng" };

  if (data.expiresAt < Date.now())
    return { success: false, message: "OTP đã hết hạn" };

  return { success: true, message: "OTP hợp lệ" };
};

export const resetPasswordService = async ({ email, otp, newPassword }) => {
  if (!email || !otp || !newPassword)
    return { success: false, message: "Thiếu dữ liệu" };

  // Kiểm tra OTP
  const otpRef = db.collection(OTP_COLLECTION).doc(email);
  const otpDoc = await otpRef.get();

  if (!otpDoc.exists)
    return { success: false, message: "OTP không tồn tại hoặc đã hết hạn" };

  const otpData = otpDoc.data();

  if (otpData.otp !== otp)
    return { success: false, message: "OTP không đúng" };

  if (otpData.expiresAt < Date.now())
    return { success: false, message: "OTP đã hết hạn" };

  // Tìm user theo email
  const snap = await db
    .collection(USERS_COLLECTION)
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty)
    return { success: false, message: "Không tìm thấy người dùng" };

  const userRef = snap.docs[0].ref;

  // Hash mật khẩu mới
  const hash = await bcrypt.hash(newPassword, 10);

  await userRef.update({
    passwordHash: hash,
    updatedAt: new Date().toISOString(),
  });

  // Xoá OTP sau khi dùng
  await otpRef.delete();

  return { success: true, message: "Đặt lại mật khẩu thành công" };
};
