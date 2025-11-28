// ===================== CONFIG =====================
const API_BASE = "http://localhost:5000/api";

// ===================== GLOBAL STATE =====================
let historyData = [];
let requests = [];
let userShifts = [];
let currentUser = null;
let token = null;
let userId = null;

// ===================== MAIN =====================
document.addEventListener("DOMContentLoaded", () => {
  const rawUser = localStorage.getItem("tkUser");
  if (!rawUser) return (window.location.href = "auth.html");

  const user = JSON.parse(rawUser);
  if (user.user.role !== "employee") return (window.location.href = "auth.html");

  // 🔥 GÁN GLOBAL
  token = user.token;
  userId = user.user.id;

  if (window.FaceID) window.FaceID.init({ jwtToken: token, uid: userId });

  // Profile
  empName.textContent = user.user.name || "User";
  empDept.textContent = user.user.dept || "Không rõ";
  empAvatar.src = miniAvatar.src = "assets/v.jpg";

  empLogout.onclick = () => {
    localStorage.removeItem("tkUser");
    window.location.href = "auth.html";
  };

  document.querySelectorAll(".nav-item").forEach((btn) => {
    const route = btn.dataset.route;
    if (!route) return;
    btn.onclick = () => goto(route, btn);
  });

  btnFaceCheckin.onclick = () => window.FaceID?.checkIn();
  btnFaceCheckout.onclick = () => window.FaceID?.checkOut();
  btnFaceEnroll.onclick = () => window.FaceID?.enroll();

  loadSummaryAndHistory(userId, token);
  loadMyRequests(userId, token);

  btnFilter.onclick = () => {
    const f = fromDate.value;
    const t = toDate.value;
    let d = historyData;
    if (f) d = d.filter((x) => x.date >= f);
    if (t) d = d.filter((x) => x.date <= t);
    renderHistory(d);
  };

  setupRequestForm(userId, token);
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
    if (!data.success || !Array.isArray(data.data)) return (userShifts = []);

    userShifts = data.data.map((s) => {
      if (!s.date) return s;
      let d = s.date.trim();

      // 🔥 Normalize dd/mm/yyyy
      if (d.includes("/")) {
        const [dd, mm, yyyy] = d.split("/");
        d = `${yyyy}-${mm}-${dd}`;
      }

      return { ...s, date: d };
    });
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

// ===================== REQUEST FORM =====================
function setupRequestForm(userId, token) {
  btnRequest.onclick = () => requestModal.showModal();
  reqCancel.onclick = () => requestModal.close();

  requestForm.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      type: reqType.value,
      date: reqDate.value,
      shift: reqShift.value,
      cin: reqIn.value,
      cout: reqOut.value,
      note: reqNote.value,
    };

    try {
      const res = await fetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) return alert(data.message || "Gửi yêu cầu thất bại");

      alert("Đã gửi yêu cầu. Quản lý sẽ xem xét.");
      requestModal.close();
      requestForm.reset();

      loadMyRequests(userId, token);
    } catch (err) {
      alert("Không kết nối được server!");
    }
  };
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
