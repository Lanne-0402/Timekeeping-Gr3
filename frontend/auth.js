const API_BASE = "https://timekeeping-gr3.onrender.com/api";

// DOM
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const otpForm = document.getElementById("otpForm");
const stepLogin = document.getElementById("stepLogin");
const stepRegister = document.getElementById("stepRegister");
const stepOtp = document.getElementById("stepOtp");
const formForgot = document.getElementById("form-forgot");
const formForgotOtp = document.getElementById("form-forgot-otp");
const formResetPass = document.getElementById("form-reset-pass");

const toRegisterBtn = document.getElementById("toRegisterBtn");
const toLoginBtn = document.getElementById("toLoginBtn");

let pendingRegisterData = null; // lưu info đăng ký để verify
let lastForgotEmail = "";
let lastForgotOtp = "";


// =========================
// Helper notify
// =========================
function toast(msg) {
  alert(msg);
}


// =========================
// Chuyển bước UI

document.querySelectorAll(".view-switch").forEach(btn => {
    btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        showView(view);
    });
});

function showView(view) {
    console.log("Switch to:", view);

    document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));

    if (view === "login") loginForm.classList.add("active");
    if (view === "register") registerForm.classList.add("active");
    if (view === "otp") otpForm.classList.add("active");
    if (view === "reset") resetForm.classList.add("active");
}
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

   document.querySelectorAll(".view-switch").forEach(btn => {
        btn.addEventListener("click", () => {
            const view = btn.dataset.view;
            showView(view);
        });
    });

    function showView(view) {
         document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));

        if (view === "login") loginForm.classList.add("active");
        if (view === "register") registerForm.classList.add("active");
        if (view === "otp") otpForm.classList.add("active");

        // NEW
        if (view === "forgot") formForgot.classList.add("active");
        if (view === "forgot-otp") formForgotOtp.classList.add("active");
        if (view === "reset-pass") formResetPass.classList.add("active");

    }


    // ==============================
    // TOGGLE PASSWORD
    // ==============================
    document.querySelectorAll(".toggle-pass").forEach(btn => {
        btn.onclick = () => {
            const target = btn.dataset.target;
            const input = document.getElementById(target);

            if (input.type === "password") {
                input.type = "text";
                btn.classList.add("show");
            } else {
                input.type = "password";
                btn.classList.remove("show");
            }
        };
    });


    const registerBtn = document.getElementById("btnRegister");

registerBtn.onclick = async () => {
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const pass = document.getElementById("registerPassword").value.trim();
  const pass2 = document.getElementById("registerConfirmPassword").value.trim();

  if (!name || !email || !pass || !pass2) {
    return toast("Vui lòng nhập đầy đủ thông tin");
  }

  if (pass !== pass2) {
    return toast("Mật khẩu xác nhận không khớp");
  }

  try {
    const res = await fetch(`${API_BASE}/auth/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (!data.success) return toast(data.message);

    // Lưu lại thông tin để verify
    pendingRegister = { name, email, password: pass };

    // Hiện OTP UI
    showView("otp");

    // SỬA ĐÚNG ID (otpEmailText trong HTML)
    document.getElementById("otpEmailText").textContent = email;

  } catch (err) {
    console.error(err);
    toast("Không gửi được OTP. Vui lòng thử lại.");
  }
};

// ==============================
// SUBMIT OTP (FIXED)
// ==============================
otpForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!pendingRegister) return toast("Thiếu dữ liệu đăng ký");

  const otp = document.getElementById("otpInput").value.trim();
  if (!otp) return toast("Vui lòng nhập OTP");

  const payload = {
    email: pendingRegister.email,
    name: pendingRegister.name,
    password: pendingRegister.password,
    otp
  };

  try {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      return toast(data.message || "OTP không hợp lệ");
    }

    toast("Đăng ký thành công! Hãy đăng nhập.");

    showView("login");

  } catch (err) {
    console.error(err);
    toast("Lỗi khi xác thực OTP");
  }
});

// STEP 1: GỬI OTP
formForgot.onsubmit = async (e) => {
  e.preventDefault();

  const email = fpEmail.value.trim();
  lastForgotEmail = email;

  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const data = await res.json();
  if (!data.success) return fpError.innerText = data.message;

  showView("forgot-otp");
};
formForgotOtp.onsubmit = async (e) => {
  e.preventDefault();

  const otp = fpOtp.value.trim();
  lastForgotOtp = otp;

  const res = await fetch(`${API_BASE}/auth/reset-password/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: lastForgotEmail, otp })
  });

  const data = await res.json();
  if (!data.success) return fpOtpError.innerText = data.message;

  showView("reset-pass");
};


formResetPass.onsubmit = async (e) => {
  e.preventDefault();

  const p1 = fpNewPass1.value.trim();
  const p2 = fpNewPass2.value.trim();

  if (p1 !== p2) {
    fpResetError.innerText = "Mật khẩu không trùng khớp.";
    return;
  }

  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: lastForgotEmail,
      otp: lastForgotOtp,
      newPassword: p1
    })
  });

  const data = await res.json();
  if (!data.success) return fpResetError.innerText = data.message;

  alert("Đặt lại mật khẩu thành công!");
  showView("login");
};
// =========================
// Toggle hiển / ẩn mật khẩu
// =========================
document.querySelectorAll(".toggle-pw").forEach(icon => {
  icon.addEventListener("click", () => {
    const targetId = icon.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";

    // optional: đổi độ đậm cho dễ nhìn
    icon.style.opacity = isPassword ? 1 : 0.7;
  });
});
