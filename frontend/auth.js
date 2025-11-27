// ===========================================
// AUTH FINAL – SỬA THEO ID (KHÔNG LỖI undefined)
// ===========================================

const API_BASE = "http://localhost:5000/api";

// DOM
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const otpForm = document.getElementById("otpForm");
const stepLogin = document.getElementById("stepLogin");
const stepRegister = document.getElementById("stepRegister");
const stepOtp = document.getElementById("stepOtp");

const toRegisterBtn = document.getElementById("toRegisterBtn");
const toLoginBtn = document.getElementById("toLoginBtn");

let pendingRegisterData = null; // lưu info đăng ký để verify


// =========================
// Helper notify
// =========================
function toast(msg) {
  alert(msg);
}


// =========================
// Chuyển bước UI
// =========================
function goStep(step) {
  stepLogin.classList.add("hidden");
  stepRegister.classList.add("hidden");
  stepOtp.classList.add("hidden");

  if (step === "login") stepLogin.classList.remove("hidden");
  if (step === "register") stepRegister.classList.remove("hidden");
  if (step === "otp") stepOtp.classList.remove("hidden");
}

// Nút điều hướng
if (toRegisterBtn) toRegisterBtn.onclick = () => goStep("register");
if (toLoginBtn) toLoginBtn.onclick = () => goStep("login");


// =========================
// ĐĂNG NHẬP
// =========================
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value.trim();

    if (!email || !password) {
      toast("Vui lòng nhập email và mật khẩu");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const json = await res.json().catch(() => null);

      if (!json || !json.success) {
        toast(json?.message || "Sai email hoặc mật khẩu");
        return;
      }

      // Lưu token vào localStorage
      localStorage.setItem("tkUser", JSON.stringify(json.data));

      // Điều hướng theo role
      const role = json.data.user?.role;

      if (role === "admin" || role === "manager" || role === "System Admin") {
          window.location.href = "manager.html";
      } else {
          window.location.href = "employee.html";
      }

    } catch (err) {
      console.error(err);
      toast("Không thể kết nối server");
    }
  });
}



// =========================
// GỬI OTP KHI ĐĂNG KÝ
// =========================
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("registerName")?.value.trim();
    const email = document.getElementById("registerEmail")?.value.trim();
    const password = document.getElementById("registerPassword")?.value.trim();

    if (!name || !email || !password) {
      toast("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const json = await res.json().catch(() => null);

      if (!json || !json.success) {
        toast(json?.message || "Không gửi được OTP");
        return;
      }

      pendingRegisterData = { name, email, password };
      goStep("otp");

    } catch (err) {
      console.error(err);
      toast("Không thể gửi OTP");
    }
  });
}



// =========================
// VERIFY OTP → TẠO TÀI KHOẢN
// =========================
if (otpForm) {
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const otp = document.getElementById("otpCode")?.value.trim();

    if (!otp) {
      toast("Vui lòng nhập mã OTP");
      return;
    }

    try {
      // Verify OTP
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: pendingRegisterData.email,
          otp
        })
      });

      const json = await res.json().catch(() => null);

      if (!json || !json.success) {
        toast(json?.message || "Mã OTP không đúng");
        return;
      }

      // Tạo tài khoản sau khi verify thành công
      const res2 = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingRegisterData)
      });

      const json2 = await res2.json().catch(() => null);

      if (!json2 || !json2.success) {
        toast(json2?.message || "Đăng ký thất bại");
        return;
      }

      toast("Đăng ký thành công! Mời bạn đăng nhập.");
      goStep("login");

    } catch (err) {
      console.error(err);
      toast("Không thể xác thực OTP");
    }
  });
}
