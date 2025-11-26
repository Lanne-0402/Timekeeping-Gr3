// ====== Data demo ======
const EMP = {
  name: "Nguyễn Ngọc Gia Hân",
  dept: "Kinh doanh",
  avatar: "https://i.pravatar.cc/96?img=15"
};

let historyData = [
  {date:'2025-11-01', in:'08:03', out:'17:01', work:478, note:'QR'},
  {date:'2025-11-03', in:'08:00', out:'17:02', work:482, note:'QR'},
  {date:'2025-11-04', in:'08:06', out:'16:59', work:473, note:'QR'},
  {date:'2025-11-07', in:'08:02', out:'17:00', work:478, note:'QR'},
  {date:'2025-11-10', in:'08:01', out:'17:05', work:484, note:'QR'}
];

// danh sách yêu cầu chỉnh sửa / khiếu nại (demo – lưu tạm trên RAM)
let requests = [];

document.addEventListener("DOMContentLoaded", () => {
  // ===== Kiểm tra đăng nhập & role =====
  const rawUser = localStorage.getItem("tkUser");
  if (!rawUser) {
    window.location.href = "auth.html";
    return;
  }
  const user = JSON.parse(rawUser);

  if (user.role !== "employee") {
    window.location.href = "auth.html";
    return;
  }

  // ===== Nút đăng xuất =====
  const empLogoutBtn = document.getElementById("empLogout");
  empLogoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("tkUser");
    window.location.href = "auth.html";
  });

  // ===== Router menu trái (bỏ qua nút không có data-route như Đăng xuất) =====
  document.querySelectorAll(".nav-item").forEach(btn => {
    const route = btn.dataset.route;
    if (!route) return;
    btn.onclick = () => goto(route, btn);
  });

  // ===== Profile (lấy từ user nếu có, fallback EMP) =====
  const displayName = user.name || EMP.name;
  const displayDept = user.dept || EMP.dept;

  if (typeof empName !== "undefined") {
    empName.textContent = displayName;
  }
  if (typeof empDept !== "undefined") {
    empDept.textContent = displayDept;
  }
  if (typeof empAvatar !== "undefined") {
    empAvatar.src = EMP.avatar;
  }
  if (typeof miniAvatar !== "undefined") {
    miniAvatar.src = EMP.avatar;
  }

  // ===== Cột phải: Tổng quan + danh sách yêu cầu =====
  renderActivity();
  renderRequests();

  // ===== Trang chủ: Lịch + nút QR =====
  buildCalendar(new Date());
  document.querySelectorAll(".checkin, .checkout").forEach(b => {
    b.addEventListener("click", () => qrModal.showModal());
  });

  // ===== Lịch sử: lọc theo ngày =====
  const btnFilter = document.getElementById("btnFilter");
  const fromDate  = document.getElementById("fromDate");
  const toDate    = document.getElementById("toDate");

  btnFilter?.addEventListener("click", () => {
    const f = fromDate.value;
    const t = toDate.value;
    let d = historyData;
    if (f) d = d.filter(x => x.date >= f);
    if (t) d = d.filter(x => x.date <= t);
    renderHistory(d);
  });

  // ===== Modal YÊU CẦU (chỉnh sửa / khiếu nại) =====
  const btnReq       = document.getElementById("btnRequest");
  const requestModal = document.getElementById("requestModal");
  const requestForm  = document.getElementById("requestForm");
  const reqCancel    = document.getElementById("reqCancel");

  btnReq?.addEventListener("click", () => {
    requestModal?.showModal();
  });

  reqCancel?.addEventListener("click", () => {
    requestModal?.close();
  });

  requestForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const item = {
      type:  reqType.value,          // chinh-sua | khieu-nai
      date:  reqDate.value,
      shift: reqShift.value,         // Sáng | Chiều | Khác
      cin:   reqIn.value,
      cout:  reqOut.value,
      note:  reqNote.value,
      status:'Đã gửi'
    };
    requests.unshift(item);
    renderRequests();
    requestModal.close();
    requestForm.reset();
  });

  // ===== Cài đặt: đổi mật khẩu (demo) =====
  const changePassForm = document.getElementById("changePassForm");
  const changePassMsg  = document.getElementById("changePassMsg");

  if (changePassForm && changePassMsg) {
    changePassForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const cur = document.getElementById("curPass").value;
      const p1  = document.getElementById("newPass").value;
      const p2  = document.getElementById("newPass2").value;

      changePassMsg.classList.remove("error");
      changePassMsg.textContent = "";

      // Demo: mật khẩu hiện tại của TK demo là 123456
      const currentDemoPass = "123456";
      if (cur !== currentDemoPass) {
        changePassMsg.textContent = "Mật khẩu hiện tại không đúng.";
        changePassMsg.classList.add("error");
        return;
      }

      if (p1.length < 6) {
        changePassMsg.textContent = "Mật khẩu mới phải ít nhất 6 ký tự.";
        changePassMsg.classList.add("error");
        return;
      }
      if (p1 !== p2) {
        changePassMsg.textContent = "Mật khẩu nhập lại không khớp.";
        changePassMsg.classList.add("error");
        return;
      }

      // Demo: chỉ hiển thị thông báo, chưa liên kết với logic đăng nhập thật
      changePassMsg.textContent =
        "Đổi mật khẩu thành công";
      changePassForm.reset();
    });
  }
});

// ====== Router ======
function goto(route, btn){
  document.querySelectorAll(".route")
    .forEach(s => s.classList.toggle("hidden", s.id !== route));
  document.querySelectorAll(".nav-item")
    .forEach(b => b.classList.toggle("active", b === btn));

  if (route === 'history') {
    const hasRow = document.querySelector("#histTable tbody")?.children.length;
    if (!hasRow) renderHistory(historyData);
  }
}

// ====== Activity (ngày làm/nghỉ trong THÁNG HIỆN TẠI) ======
function renderActivity(){
  const set = new Set(historyData.map(x => x.date));
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth();
  const todayDate = now.getDate();

  let worked = 0;
  for(let d=1; d<=todayDate; d++){
    const dd = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (set.has(dd)) worked++;
  }
  daysWorked.textContent = worked;
  daysOff.textContent    = Math.max(0, todayDate - worked);
}

// ====== Calendar (✓ đã chấm / ✗ chưa chấm / ngày tương lai để trống) ======
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
  let startIndex = (first.getDay()+6) % 7; // T2=0
  const days = new Date(y, m+1, 0).getDate();

  const attend = new Set(historyData.map(h => h.date));
  const today  = new Date(); today.setHours(0,0,0,0);

  // ô trống đầu tháng
  for(let i=0;i<startIndex;i++){
    const blank = document.createElement("div");
    blank.className = "cell";
    blank.style.visibility = "hidden";
    grid.appendChild(blank);
  }
  // các ngày
  for(let d=1; d<=days; d++){
    const cell = document.createElement("div");
    const key = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const thisDay = new Date(y, m, d);
    thisDay.setHours(0,0,0,0);

    if (thisDay > today){
      cell.className = "cell";
      cell.innerHTML = `<div class="day">${d}</div><div class="mark" style="color:#cbd5e1">&nbsp;</div>`;
    } else {
      const marked = attend.has(key);
      cell.className = `cell ${marked ? 'ok' : 'no'}`;
      cell.innerHTML = `<div class="day">${d}</div><div class="mark">${marked ? '✓' : '✗'}</div>`;
    }
    grid.appendChild(cell);
  }

  prevM.onclick = () => buildCalendar(new Date(y, m-1, 1));
  nextM.onclick = () => buildCalendar(new Date(y, m+1, 1));
}

// ====== History ======
function renderHistory(list){
  const tb = document.querySelector("#histTable tbody");
  tb.innerHTML = list.map(r => {
    const mins = r.work;
    const hh = Math.floor(mins/60), mm = mins%60;
    return `<tr>
      <td>${r.date}</td>
      <td>${r.in}</td>
      <td>${r.out}</td>
      <td>${hh}h ${String(mm).padStart(2,'0')}m</td>
      <td>${r.note || ""}</td>
    </tr>`;
  }).join("");
}

// ====== Requests (hiển thị danh sách yêu cầu đã gửi) ======
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
        ${r.cin || r.cout ? ` • ${r.cin || ''} - ${r.cout || ''}` : ''}
        <br><span class="muted">${r.note || ''}</span>
      </div>
      <span class="status pending">${r.status}</span>
    </li>
  `).join('');
}
