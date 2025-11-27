// ===================== CONFIG =====================
const API_BASE = "http://localhost:5000/api"; // đổi sang domain của bạn nếu deploy

// ===================== GLOBAL STATE =====================
let historyData = [];     // dữ liệu lịch sử lấy từ BE
let requests = [];        // yêu cầu chỉnh sửa lấy từ BE
let userShifts = [];      // ca làm được manager gán từ BE
let currentUser = null;
let token = null;
let userId = null;
// ===================== MAIN =====================
document.addEventListener("DOMContentLoaded", () => {

  // ===== Kiểm tra đăng nhập =====
  const rawUser = localStorage.getItem("tkUser");
  if (!rawUser) {
    window.location.href = "auth.html";
    return;
  }
  const user = JSON.parse(rawUser);

  if (user.user.role !== "employee") {
    window.location.href = "auth.html";
    return;
  }

  token = user.token;
  userId = user.user.id; 

  // >>> NEW: khởi tạo FaceID (đã đồng bộ với faceid.js final: có uid)
  if (window.FaceID) {
    window.FaceID.init({ jwtToken: token, uid: userId });
  }

  // ===== Profile =====
  const displayName = user.user.name || "User";
  const displayDept = user.user.dept || "Không rõ";
  if (typeof empName !== "undefined") empName.textContent = displayName;
  if (typeof empDept !== "undefined") empDept.textContent = displayDept;
  if (typeof empAvatar !== "undefined") empAvatar.src = "assets/v.jpg";
  if (typeof miniAvatar !== "undefined") miniAvatar.src = "assets/v.jpg";

  // ===== Nút đăng xuất =====
  const empLogoutBtn = document.getElementById("empLogout");
  empLogoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("tkUser");
    window.location.href = "auth.html";
  });

  // ===== Router =====
  document.querySelectorAll(".nav-item").forEach(btn => {
    const route = btn.dataset.route;
    if (!route) return;
    btn.onclick = () => goto(route, btn);
  });

  // ===== FaceID Check-in / Check-out / Enroll =====
  document.getElementById("btnFaceCheckin")?.addEventListener("click", () => {
    window.FaceID?.checkIn();
  });

  document.getElementById("btnFaceCheckout")?.addEventListener("click", () => {
    window.FaceID?.checkOut();
  });

  document.getElementById("btnFaceEnroll")?.addEventListener("click", () => {
    window.FaceID?.enroll();
  });

  // ===== Load dữ liệu từ BE =====
  loadSummaryAndHistory(userId, token);
  loadMyRequests(userId, token);

  // ===== Lọc lịch sử =====
  btnFilter?.addEventListener("click", () => {
    const f = fromDate.value;
    const t = toDate.value;

    let d = historyData;
    if (f) d = d.filter(x => x.date >= f);
    if (t) d = d.filter(x => x.date <= t);

    renderHistory(d);
  });

  // ===== Gửi yêu cầu chỉnh sửa / khiếu nại =====
  setupRequestForm(userId, token);
});

// ===================== LOAD DATA FROM BACKEND =====================

// ---- Tải Summary + History + Shifts ----
async function loadSummaryAndHistory(userId, token) {
  // 1. Summary
  try {
    const res = await fetch(`${API_BASE}/attendance/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      daysWorked.textContent = data.data.daysWorked ?? 0;
      daysOff.textContent    = data.data.daysOff ?? 0;
    }
  } catch (err) {
    console.error("Summary error:", err);
  }

  // 2. History
  try {
    const res = await fetch(`${API_BASE}/attendance/history`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      historyData = data.data.map(item => ({
        date: item.date,
        in:   item.checkIn,
        out:  item.checkOut,
        work: item.workMinutes,
        note: item.note || "QR"
      }));

      // 3. NEW: load ca làm từ backend (phụ thuộc manager gán)
      await loadMyShifts(userId, token);

      renderActivity();
      renderHistory(historyData);
      buildCalendar(new Date());
    }
  } catch (err) {
    console.error("History error:", err);
  }
}

// ---- Tải ca làm (shifts) từ BE ----
async function loadMyShifts(userId, token) {
  try {
    const res = await fetch(`${API_BASE}/shifts/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (!data.success || !Array.isArray(data.data)) {
      userShifts = [];
      return;
    }

    userShifts = data.data.map(s => {
      // Không có ngày → giữ nguyên
      if (!s.date) return s;

      const raw = s.date.trim();  
      // Format chuẩn BE mới → YYYY-MM-DD
      if (raw.includes("-")) {
        return { ...s, date: raw };
      }

      // Format BE cũ → DD/MM/YYYY
      if (raw.includes("/")) {
        const [dd, mm, yyyy] = raw.split("/");
        if (dd && mm && yyyy) {
          return {
            ...s,
            date: `${yyyy}-${mm}-${dd}`   // Chuẩn hóa về YYYY-MM-DD
          };
        }
      }

      // fallback
      return s;
    });

    console.log("📌 Shifts sau khi chuẩn hóa =", userShifts);

  } catch (err) {
    console.error("❌ Load shifts error:", err);
    userShifts = [];
  }
}



// ===================== REQUEST FORM (gửi yêu cầu) =====================

function setupRequestForm(userId, token) {
  const btnReq = document.getElementById("btnRequest");
  const requestModal = document.getElementById("requestModal");
  const reqCancel = document.getElementById("reqCancel");
  const requestForm = document.getElementById("requestForm");

  btnReq?.addEventListener("click", () => {
    requestModal.showModal();
  });

  reqCancel?.addEventListener("click", () => {
    requestModal.close();
  });

  requestForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      type: reqType.value,
      date: reqDate.value,
      shift: reqShift.value,
      cin: reqIn.value,
      cout: reqOut.value,
      note: reqNote.value
    };

    try {
      const res = await fetch(`${API_BASE}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Gửi yêu cầu thất bại");
        return;
      }

      alert("Đã gửi yêu cầu. Quản lý sẽ xem xét.");
      requestModal.close();
      requestForm.reset();

      loadMyRequests(userId, token);
    } catch (err) {
      console.error(err);
      alert("Không kết nối được server!");
    }
  });
}

// ===================== ROUTER =====================

function goto(route, btn){
  document.querySelectorAll(".route")
    .forEach(s => s.classList.toggle("hidden", s.id !== route));

  document.querySelectorAll(".nav-item")
    .forEach(b => b.classList.toggle("active", b === btn));

  if (route === "history") {
    const hasRow = document.querySelector("#histTable tbody")?.children.length;
    if (!hasRow) renderHistory(historyData);
  }
}

// ===================== UI RENDER FUNCTIONS =====================

// ---- Tổng quan (cột phải) ----
function renderActivity(){
  const set = new Set(historyData.map(x => x.date));
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const todayDate = now.getDate();

  let worked = 0;
  for(let d = 1; d <= todayDate; d++){
    const dd = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (set.has(dd)) worked++;
  }
  daysWorked.textContent = worked;
  daysOff.textContent = Math.max(0, todayDate - worked);
}

// ---- Lịch tháng ----
let currentDate = new Date();

function buildCalendar(date){
  currentDate = date;
  const y = date.getFullYear();
  const m = date.getMonth();
  calTitle.textContent = `Lịch tháng ${m+1}/${y}`;

  const grid = calendarGrid;
  grid.innerHTML = "";

  const headers = ["T2","T3","T4","T5","T6","T7","CN"];
  headers.forEach(h => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.background = "#f7fafc";
    cell.innerHTML = `<div class="day" style="font-weight:600">${h}</div>`;
    grid.appendChild(cell);
  });

  const first = new Date(y, m, 1);
  let startIndex = (first.getDay()+6)%7;
  const days = new Date(y, m+1, 0).getDate();

  const attend = new Set(historyData.map(h => h.date));
  const today  = new Date(); today.setHours(0,0,0,0);

  // NEW: map ngày -> danh sách ca
  const shiftMap = {};
  userShifts.forEach(s => {
    if (!s.date) return;
    if (!shiftMap[s.date]) shiftMap[s.date] = [];
    shiftMap[s.date].push(s);
  });

  for(let i=0;i<startIndex;i++){
    const blank = document.createElement("div");
    blank.className = "cell";
    blank.style.visibility = "hidden";
    grid.appendChild(blank);
  }

  for(let d=1; d<=days; d++){
    const cell = document.createElement("div");
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const thisDay = new Date(y, m, d);
    thisDay.setHours(0,0,0,0);

    const hasShift = shiftMap[key];
    const marked   = attend.has(key);

    if (thisDay > today){
      // ngày tương lai
      cell.className = "cell future";
      cell.innerHTML = `
        <div class="day">${d}</div>
        <div class="mark" style="color:#cbd5e1">&nbsp;</div>
      `;
    } else if (hasShift) {
      // ngày có ca (phụ thuộc manager đã gán ca hay chưa)
      cell.className = `cell shift ${marked ? 'ok' : 'no'}`;
      cell.innerHTML = `
        <div class="day">${d}</div>
        <div class="mark">${marked ? '✓' : '✗'}</div>
        <div class="shift-badge">${hasShift.length} ca</div>
      `;
    } else {
      // ngày KHÔNG có ca → để trống
      cell.className = "cell no-shift";
      cell.innerHTML = `
        <div class="day">${d}</div>
        <div class="mark">&nbsp;</div>
      `;
    }
    grid.appendChild(cell);
  }

  prevM.onclick = () => buildCalendar(new Date(y, m-1, 1));
  nextM.onclick = () => buildCalendar(new Date(y, m+1, 1));
}

// ---- Lịch sử ----
function renderHistory(list){
  const tb = document.querySelector("#histTable tbody");
  tb.innerHTML = list.map(r => {
    const mins = r.work;
    const hh = Math.floor(mins/60), mm = mins%60;
    return `
      <tr>
        <td>${r.date}</td>
        <td>${r.in}</td>
        <td>${r.out}</td>
        <td>${hh}h ${String(mm).padStart(2,'0')}m</td>
        <td>${r.note || ""}</td>
      </tr>`;
  }).join("");
}

// ---- Yêu cầu ----
function renderRequests(){
  const list = document.getElementById('reqList');
  if (!list) return;

  if (requests.length === 0){
    list.innerHTML = '<li class="empty muted">Chưa có yêu cầu nào</li>';
    return;
  }

  list.innerHTML = requests.map(r => `
    <li>
      <div>
        <strong>${r.type === 'chinh-sua' ? 'Chỉnh sửa' : 'Khiếu nại'}</strong>
        • ${r.date || 'Không rõ ngày'} (${r.shift || 'Ca ?'})
        <br><span class="muted">${r.note || ''}</span>
      </div>
      <span class="status pending">${r.status}</span>
    </li>
  `).join("");
}
