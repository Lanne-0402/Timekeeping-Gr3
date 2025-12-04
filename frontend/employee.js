// ===================== CONFIG =====================
const API_BASE = "http://localhost:5000/api";

// ===================== GLOBAL STATE =====================
let historyData = [];
let userShifts = [];
let currentUser = null;
let token = null;
let userId = null;

// ===================== MAIN =====================
// ===================== MAIN =====================
document.addEventListener("DOMContentLoaded", () => {
  const rawUser = localStorage.getItem("tkUser");
  if (!rawUser) return (window.location.href = "auth.html");

  const user = JSON.parse(rawUser);
  if (user.user.role !== "user") return (window.location.href = "auth.html");

  // --- Lấy DOM an toàn ---
  const empName = document.getElementById("empName");
  const empDept = document.getElementById("empDept");
  const miniName = document.getElementById("miniName");
  const empLogout = document.getElementById("empLogout");

  const btnFaceCheckin  = document.getElementById("btnFaceCheckin");
  const btnFaceCheckout = document.getElementById("btnFaceCheckout");
  const btnFaceEnroll   = document.getElementById("btnFaceEnroll");   // nút cũ trên trang Home (có thể bị xoá)
  const btnEnrollFaceID = document.getElementById("btnEnrollFaceID"); // nút mới trong Cài đặt

  const btnFilter = document.getElementById("btnFilter");
  const fromDate  = document.getElementById("fromDate");
  const toDate    = document.getElementById("toDate");

  // 🔥 GÁN GLOBAL
  token  = user.token;
  userId = user.user.id;

  if (window.FaceID) {
    window.FaceID.init({ jwtToken: token, uid: userId });
  }

  // Profile
  if (empName)  empName.textContent  = user.user.name || "User";
  if (empDept)  empDept.textContent  = user.user.dept || "Không rõ";
  if (miniName) miniName.textContent = user.user.name;

  // Logout
  if (empLogout) {
    empLogout.onclick = () => {
      localStorage.removeItem("tkUser");
      window.location.href = "auth.html";
    };
  }

  // Nav left
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const route = btn.dataset.route;
    if (!route) return;
    btn.onclick = () => goto(route, btn);
  });

  // FaceID buttons (chỉ gán nếu tồn tại)
  if (btnFaceCheckin) {
    btnFaceCheckin.onclick = () => window.FaceID?.checkIn();
  }
  if (btnFaceCheckout) {
    btnFaceCheckout.onclick = () => window.FaceID?.checkOut();
  }
  // nút cũ trên trang Home (có thể đã xoá khỏi HTML, không sao)
  if (btnFaceEnroll) {
    btnFaceEnroll.onclick = () => window.FaceID?.enroll();
  }
  // nút mới trong tab Cài đặt
  if (btnEnrollFaceID) {
    btnEnrollFaceID.onclick = () => window.FaceID?.enroll();
  }

  // Load dữ liệu + build calendar
  loadSummaryAndHistory(userId, token);

  // Filter lịch sử
  if (btnFilter && fromDate && toDate) {
    btnFilter.onclick = () => {
      const f = fromDate.value;
      const t = toDate.value;
      let d = historyData;
      if (f) d = d.filter((x) => x.date >= f);
      if (t) d = d.filter((x) => x.date <= t);
      renderHistory(d);
    };
  }
});


// ===================== LOAD SUMMARY + HISTORY + SHIFTS =====================
async function loadSummaryAndHistory(userId, token) {
  try {
    const res = await fetch(`${API_BASE}/attendance/summary`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
    }
  } catch (err) {}

  try {
    const res = await fetch(`${API_BASE}/attendance/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      historyData = data.data.map((item) => ({
        date: item.date,
        in: item.checkIn,
        out: item.checkOut,
        work: item.workMinutes,
        note: item.note || "Checkin",
      }));

      await loadMyShifts(userId, token);


      renderHistory(historyData);
      buildCalendar(currentDate);
    }
  } catch (err) {}
}

// ===================== LOAD USER SHIFTS =====================
async function loadMyShifts(userId, token) {
  try {
    const res = await fetch(`${API_BASE}/shifts/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) {
      userShifts = [];
      return;
    }

    // Lấy shift chi tiết theo shiftId
    const detailed = [];

    for (const rec of data.data) {
      const r = await fetch(`${API_BASE}/shifts/${rec.shiftId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await r.json();
      if (json.success && json.data) {
        let s = json.data;

        // chuẩn hoá ngày yyyy-mm-dd
        let d = s.date.trim();
        if (d.includes("/")) {
          const [dd, mm, yyyy] = d.split("/");
          d = `${yyyy}-${mm}-${dd}`;
        }

        detailed.push({ ...s, date: d });
      }
    }

    userShifts = detailed;  // GÁN SHIFT THẬT
  } catch (err) {
    userShifts = [];
  }
}



// ===================== BUILD CALENDAR =====================
let currentDate = new Date();

function buildCalendar(date) {
  currentDate = date;
  const y = date.getFullYear();
  const m = date.getMonth();

  calTitle.textContent = `Lịch tháng ${m + 1}/${y}`;
  calendarGrid.innerHTML = "";

  const headers = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]; headers.forEach((h) => {
    const c = document.createElement("div");
    c.className = "cell";
    c.style.background = "#f7fafc";
    c.innerHTML = `<div class='day' style='font-weight:600'>${h}</div>`;
    calendarGrid.appendChild(c);
  });

  const first = new Date(y, m, 1);
  let startIndex = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();

  const attend = new Set(historyData.map((h) => h.date));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // 🔥 Build shiftMap (fix chuẩn hoá date)
  const shiftMap = {};
  userShifts.forEach((s) => {
    if (!s.date) return;
    let d = s.date.trim();
    if (d.includes("/")) {
      const [dd, mm, yyyy] = d.split("/");
      d = `${yyyy}-${mm}-${dd}`;
    }
    if (!shiftMap[d]) shiftMap[d] = [];
    shiftMap[d].push(s);
  });

  for (let i = 0; i < startIndex; i++) {
    const blank = document.createElement("div");
    blank.className = "cell";
    blank.style.visibility = "hidden";
    calendarGrid.appendChild(blank);
  }

  for (let d = 1; d <= days; d++) {
    const cell = document.createElement("div");
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const thisDay = new Date(y, m, d);
    thisDay.setHours(0, 0, 0, 0);

    const hasShift = shiftMap[key];
    const marked = attend.has(key);

    // Ưu tiên 1: NGÀY CÓ CA
    if (hasShift) {
      cell.className = `cell shift ${marked ? "ok" : "no"}`;
      cell.innerHTML = `
          <div class='day'>${d}</div>
          <div class='mark'>${marked ? "✓" : "✗"}</div>
          <div class='shift-badge'>${hasShift.length} ca</div>
      `;
    }
    // Ưu tiên 2: NGÀY ĐÃ CHẤM CÔNG (nhưng không có ca)
    else if (marked) {
      cell.className = "cell ok";
      cell.innerHTML = `
          <div class='day'>${d}</div>
          <div class='mark'>✓</div>
      `;
    }
    // Ưu tiên 3: NGÀY TƯƠNG LAI
    else if (thisDay > today) {
      cell.className = "cell future";
      cell.innerHTML = `
          <div class='day'>${d}</div>
          <div class='mark'>&nbsp;</div>
      `;
    }
    // Ưu tiên 4: NGÀY TRỐNG KHÔNG CÓ CA
    else {
      cell.className = "cell no-shift";
      cell.innerHTML = `
          <div class='day'>${d}</div>
          <div class='mark'>&nbsp;</div>
      `;
    }
    if (hasShift) {
        cell.style.cursor = "pointer";
        cell.addEventListener("click", () => {
            openShiftModal(hasShift[0]);
        });
    }
    calendarGrid.appendChild(cell);
    
  }
  renderActivity();   // cập nhật tổng quan theo tháng đang xem
  prevM.onclick = () => buildCalendar(new Date(y, m - 1, 1));
  nextM.onclick = () => buildCalendar(new Date(y, m + 1, 1));
}

// ===================== HISTORY =====================
function renderHistory(list) {
  const tb = document.querySelector("#histTable tbody");
  tb.innerHTML = list
    .map((r) => {
      const hh = Math.floor(r.work / 60), mm = r.work % 60;
      return `
        <tr>
          <td>${r.date}</td>
          <td>${r.in}</td>
          <td>${r.out}</td>
          <td>${hh}h ${String(mm).padStart(2, "0")}</td>
          <td>${r.note || ""}</td>
        </tr>`;
    })
    .join("");
}

// ===================== ACTIVITY PANEL =====================
function renderActivity() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // --- 1) Ngày đã check-in trong tháng ---
  const attDays = Array.from(
    new Set(
      historyData
        .map((h) => h.date)
        .filter((d) => d && d.startsWith(monthKey))
    )
  );

  // --- 2) Ngày có ca làm trong tháng ---
  const shiftDays = Array.from(
    new Set(
      userShifts
        .map((s) => (s.date || "").trim())
        .filter((d) => d && d.startsWith(monthKey))
    )
  );

  // --- 3) Chỉ giữ ngày có ca TRONG QUÁ KHỨ (không tính tương lai) ---
  const pastShiftDays = shiftDays.filter((d) => {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt <= today;
  });

  // --- 4) Ngày làm = có ca + check-in ---
  const worked = pastShiftDays.filter((d) => attDays.includes(d)).length;

  // --- 5) Ngày nghỉ = có ca quá khứ nhưng không check-in ---
  const off = pastShiftDays.length - worked;

  daysWorked.textContent = worked;
  daysOff.textContent = off;
}

// ===================== ROUTER =====================
function goto(route, btn) {
  document.querySelectorAll(".route").forEach((s) =>
    s.classList.toggle("hidden", s.id !== route)
  );
  document.querySelectorAll(".nav-item").forEach((b) =>
    b.classList.toggle("active", b === btn)
  );

  if (route === "history") renderHistory(historyData);
}
// =============================
// ĐỔI MẬT KHẨU
// =============================
const changePassForm = document.getElementById("changePassForm");
if (changePassForm) {
  changePassForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cur = document.getElementById("curPass").value.trim();
    const n1 = document.getElementById("newPass").value.trim();
    const n2 = document.getElementById("newPass2").value.trim();
    const msg = document.getElementById("changePassMsg");

    msg.className = "";
    msg.textContent = "";

    if (n1 !== n2) {
      msg.textContent = "Mật khẩu mới không khớp.";
      msg.classList.add("error");
      return;
    }

    if (n1.length < 6) {
      msg.textContent = "Mật khẩu mới tối thiểu 6 ký tự.";
      msg.classList.add("error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: cur,
          newPassword: n1,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      msg.textContent = "Đổi mật khẩu thành công!";
      msg.classList.add("success");

      changePassForm.reset();
    } catch (err) {
      msg.textContent = err.message || "Lỗi hệ thống, thử lại.";
      msg.classList.add("error");
    }
  });
}
// =============================
// ĐĂNG KÝ FACEID
// =============================
const btnEnroll = document.getElementById("btnEnrollFaceID");
if (btnEnroll) {
  btnEnroll.onclick = () => {
    FaceID.enroll();
  };
}
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
function openShiftModal(shift) {
  document.getElementById("modalShiftCode").textContent = shift.shiftCode || "Không có";
  document.getElementById("modalShiftName").textContent = shift.name || "Không có";
  document.getElementById("modalShiftDate").textContent = shift.date || "";
  document.getElementById("modalShiftTime").textContent = `${shift.startTime} - ${shift.endTime}`;
  
  document.getElementById("shiftDetailModal").classList.remove("hidden");
}

document.getElementById("closeShiftDetail").onclick = () => {
  document.getElementById("shiftDetailModal").classList.add("hidden");
};
