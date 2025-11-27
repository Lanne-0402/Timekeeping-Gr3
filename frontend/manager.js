// =======================================
// Manager Panel Frontend (manager.js)
// Flow khớp với backend mới (JWT + Firestore)
// =======================================

const API_BASE = "http://localhost:5000/api";

let token = null;
let currentUser = null;

let employees = [];
let shifts = [];
let requests = [];
let reports = [];

let mapInstance = null;
let marker = null;
let circle = null;

// ---------------------------------------
// Helper: lấy user + token từ localStorage
// ---------------------------------------
function loadCurrentUser() {
  try {
    const raw = localStorage.getItem("tkUser");
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data;
  } catch (e) {
    console.error("parse tkUser error", e);
    return null;
  }
}

function getAuthHeaders(json) {
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ---------------------------------------
// INIT
// ---------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  currentUser = loadCurrentUser();
  flatpickr("#shiftDate", {
    dateFormat: "d/m/Y",
    altInput: true,
    altFormat: "d/m/Y",
    allowInput: true,
    defaultDate: new Date(),
  });

  if (!currentUser || !currentUser.token) {
    alert("Vui lòng đăng nhập lại.");
    window.location.href = "auth.html";
    return;
  }

  const allowedRoles = ["admin", "manager", "System Admin"];
if (!allowedRoles.includes(currentUser.user.role)) {
  alert("Bạn không có quyền truy cập trang quản lý.");
  window.location.href = "employee.html";
  return;
}


  token = currentUser.token;

  // Hiển thị tên trong profile
  const nameEl = document.querySelector(".profile-mini .name");
  if (nameEl && currentUser.name) nameEl.textContent = currentUser.name;

  initNavigation();
  initLogout();
  initEmployeesUI();
  initShiftsUI();
  initReportsUI();
  initRequestsUI();
  initLocationUI();
  initMiniCalendar();

  // Load dữ liệu ban đầu
  loadEmployees();
  loadShifts();
  loadRequests();
  loadReports();
  loadCompanyLocation();
});

// ---------------------------------------
// Navigation giữa các tab
// ---------------------------------------
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item[data-route]");
  const routes = document.querySelectorAll(".route");

  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.route;
      // toggle active cho nav
      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      // ẩn/hiện section
      routes.forEach((sec) => {
        if (sec.id === target) {
          sec.classList.remove("hidden");
        } else {
          sec.classList.add("hidden");
        }
      });
    });
  });
}

// ---------------------------------------
// Logout
// ---------------------------------------
function initLogout() {
  const btn = document.getElementById("mgrLogout");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      // Gọi logout backend (không bắt buộc, nhưng tốt)
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
    } catch (e) {
      console.warn("Logout error (ignored)", e);
    } finally {
      // localStorage.removeItem("tkUser");
      window.location.href = "auth.html";
    }
  });
}

// =======================================
// 1. QUẢN LÝ NHÂN VIÊN
// =======================================
function initEmployeesUI() {
  const reloadBtn = document.getElementById("btnReloadEmployees");
  if (reloadBtn) reloadBtn.addEventListener("click", loadEmployees);

  const searchInput = document.getElementById("empSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const keyword = searchInput.value.trim().toLowerCase();
      const filtered = employees.filter((u) => {
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        return name.includes(keyword) || email.includes(keyword);
      });
      renderEmployees(filtered);
    });
  }

  // Event delegation cho bảng nhân viên
  const empTable = document.getElementById("empTable");
  if (empTable) {
    empTable.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const userId = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === "edit-emp") {
        openEditEmployee(userId);
      } else if (action === "delete-emp") {
        deleteEmployee(userId);
      }
    });
  }
}

async function loadEmployees() {
  try {
    const res = await fetch(`${API_BASE}/users`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || "Không load được danh sách nhân viên");
    }

    // Ẩn admin khỏi danh sách
    employees = (json.data || []).filter(
      (u) => u.role !== "admin" && u.role !== "System Admin"
    );

    renderEmployees(employees);
    updateDashboard();
  } catch (err) {
    console.error("loadEmployees error:", err);
    alert("Không load được danh sách nhân viên");
  }
}

function renderEmployees(list) {
  const tbody = document.querySelector("#empTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Chưa có nhân viên nào.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  list.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${u.id || ""}</td>
        <td>${u.name || ""}</td>
        <td>${u.email || ""}</td>
        <td>${u.dept || "-"}</td>
        <td>${u.status || "active"}</td>
        <td>
          <button class="btn sm outline" data-action="edit-emp" data-id="${u.id}">
            Sửa
          </button>
          <button class="btn sm danger" data-action="delete-emp" data-id="${u.id}">
            Xóa
          </button>
        </td>
      `;
    tbody.appendChild(tr);
  });
}

// Sửa thông tin nhân viên (dùng prompt đơn giản)
async function openEditEmployee(userId) {
  const user = employees.find((u) => u.id === userId);
  if (!user) return;

  const newName = prompt("Họ tên:", user.name || "");
  if (newName === null) return;

  const newDept = prompt("Bộ phận:", user.dept || "");
  if (newDept === null) return;

  const newRole = prompt("Chức vụ (employee/manager):", user.role || "employee");
  if (newRole === null) return;

  const newStatus = prompt("Trạng thái (active/inactive):", user.status || "active");
  if (newStatus === null) return;

  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name: newName.trim(),
        dept: newDept.trim(),
        role: newRole.trim(),
        status: newStatus.trim(),
      }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Cập nhật thất bại");
    alert("Cập nhật nhân viên thành công");
    loadEmployees();
  } catch (err) {
    console.error("update employee error:", err);
    alert("Không cập nhật được nhân viên");
  }
}

async function deleteEmployee(userId) {
  const user = employees.find((u) => u.id === userId);
  if (!user) return;

  if (!confirm(`Bạn chắc chắn muốn xóa nhân viên ${user.name || user.id}?`)) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Xóa thất bại");
    alert("Xóa nhân viên thành công");
    loadEmployees();
  } catch (err) {
    console.error("delete employee error:", err);
    alert("Không xóa được nhân viên");
  }
}

// Gán ca làm (nhập date + chọn shift)
function openAssignShift(userId) {
  if (!shifts || shifts.length === 0) {
    alert("Chưa có ca làm nào, hãy tạo ca trước.");
    return;
  }

  const date = prompt("Nhập ngày làm (YYYY-MM-DD):");
  if (!date) return;

  // Gợi ý danh sách shift
  const shiftListText = shifts
    .map((s, idx) => `${idx + 1}. ${s.name} (${s.startTime} - ${s.endTime})`)
    .join("\n");

  const idxStr = prompt(
    "Chọn ca bằng số thứ tự:\n" + shiftListText
  );
  if (!idxStr) return;

  const idxNum = parseInt(idxStr, 10) - 1;
  if (Number.isNaN(idxNum) || idxNum < 0 || idxNum >= shifts.length) {
    alert("Lựa chọn không hợp lệ");
    return;
  }

  const shift = shifts[idxNum];
  assignShiftToUser(userId, shift.id, date);
}

async function assignShiftToUser(userId, shiftId, date) {
  try {
    const res = await fetch(`${API_BASE}/shifts/assign`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, shiftId, date }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Gán ca thất bại");
    alert("Gán ca thành công!");
    updateDashboard();
  } catch (err) {
    console.error("assign shift error:", err);
    alert("Không gán được ca làm");
  }
}

// =======================================
// 2. QUẢN LÝ CA LÀM
// =======================================
function initShiftsUI() {
  const btnCreate = document.getElementById("btnCreateShift");
  if (btnCreate) {
    btnCreate.addEventListener("click", async () => {
      const date = document.getElementById("shiftDate").value;
      const startTime = document.getElementById("shiftStart").value;
      const endTime = document.getElementById("shiftEnd").value;

      if (!date || !startTime || !endTime) {
        alert("Vui lòng nhập đủ ngày, giờ bắt đầu và giờ kết thúc.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/shifts`, {
          method: "POST",
          headers: getAuthHeaders(true),          // <<< QUAN TRỌNG: gửi JSON
          body: JSON.stringify({ date, startTime, endTime }),
        });

        const json = await res.json();
        if (!json.success) throw new Error(json.message || "Tạo ca thất bại");

        // Reload danh sách ca
        loadShifts();
      } catch (err) {
        console.error("create shift error:", err);
        alert("Không tạo được ca làm");
      }
    });
  }

  // Click nút "Gán ca" ngay trên bảng ca làm
  const shiftTable = document.getElementById("shiftTable");
  if (shiftTable && !shiftTable._hasAssignListener) {
    shiftTable.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "assign-from-shift") {
        const shiftId = btn.dataset.id;
        openAssignModalForShift(shiftId);
      }
    });
    shiftTable._hasAssignListener = true;
  }

  // Nút trong popup gán ca
  const btnAssignConfirm = document.getElementById("btnAssignConfirm");
  const btnAssignClose = document.getElementById("btnAssignClose");

  if (btnAssignClose) {
    btnAssignClose.addEventListener("click", () => {
      const modal = document.getElementById("assignModal");
      if (modal) modal.classList.add("hidden");
    });
  }

  if (btnAssignConfirm) {
    btnAssignConfirm.addEventListener("click", onAssignConfirm);
  }
}


async function loadShifts() {
  try {
    const res = await fetch(`${API_BASE}/shifts`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Không load được ca làm");

    shifts = json.data || [];
    renderShifts(shifts);
    updateDashboard();
  } catch (err) {
    console.error("loadShifts error:", err);
    alert("Không load được danh sách ca làm");
  }
}

function renderShifts(list) {
  const tbody = document.querySelector("#shiftTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Chưa có ca làm nào.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  list.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td>${s.id}</td>
        <td>${s.name || ""}</td>
        <td>${s.startTime || ""}</td>
        <td>${s.endTime || ""}</td>
        <td>${s.note || ""}</td>
        <td>
          <button class="pill-btn sm" data-action="assign-from-shift" data-id="${s.id}">
            Gán ca
          </button>
        </td>
      `;
    tbody.appendChild(tr);
  });

  }
let selectedShiftId = null;

function openAssignModalForShift(shiftId) {
  selectedShiftId = shiftId || null;
  const modal = document.getElementById("assignModal");
  if (!modal) return;
  modal.classList.remove("hidden");

  loadAssignUsers();
  loadAssignShifts();

  const dateInput = document.getElementById("assignDate");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
  }
}

async function loadAssignUsers() {
  try {
    const res = await fetch(`${API_BASE}/users`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    const list = json.data || [];

    const sel = document.getElementById("assignUser");
    if (!sel) return;
    sel.innerHTML = "";

    list.forEach((u) => {
      if (u.role === "admin" || u.role === "System Admin") return;
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.name || u.email || u.id;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error("loadAssignUsers error:", err);
    alert("Không load được danh sách nhân viên để gán ca");
  }
}

function loadAssignShifts() {
  const sel = document.getElementById("assignShiftSelect");
  if (!sel) return;
  sel.innerHTML = "";

  shifts.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name || `${s.startTime} - ${s.endTime}`;
    if (selectedShiftId && s.id === selectedShiftId) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
}

function onAssignConfirm() {
  const userSel = document.getElementById("assignUser");
  const shiftSel = document.getElementById("assignShiftSelect");
  const dateInput = document.getElementById("assignDate");

  if (!userSel || !shiftSel || !dateInput) return;

  const userIds = Array.from(userSel.selectedOptions).map((o) => o.value);
  const shiftIds = Array.from(shiftSel.selectedOptions).map((o) => o.value);
  const date = dateInput.value;

  if (!userIds.length) {
    alert("Vui lòng chọn ít nhất 1 nhân viên.");
    return;
  }
  if (!shiftIds.length) {
    alert("Vui lòng chọn ít nhất 1 ca làm.");
    return;
  }
  if (!date) {
    alert("Vui lòng chọn ngày.");
    return;
  }

  assignShifts(userIds, shiftIds, date);
}

async function assignShifts(userIds, shiftIds, date) {
  try {
    const res = await fetch(`${API_BASE}/shifts/assign`, {
      method: "POST",
      headers: getAuthHeaders(true),          // gửi JSON chuẩn
      body: JSON.stringify({ userIds, shiftIds, date }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Gán ca thất bại");

    alert("Đã gán ca thành công!");
    const modal = document.getElementById("assignModal");
    if (modal) modal.classList.add("hidden");
    updateDashboard();
  } catch (err) {
    console.error("assignShifts error:", err);
    alert("Không gán được ca làm");
  }
}


async function loadAssignUsers() {
  const res = await fetch(`${API_BASE}/users`, {
    headers: getAuthHeaders(),
  });
  const json = await res.json();
  const list = json.data || [];

  const sel = document.getElementById("assignUser");
  sel.innerHTML = "";
  list.forEach(u => {
    if (u.role !== "admin") {
      sel.innerHTML += `<option value="${u.id}">${u.name}</option>`;
    }
  });
}
function loadAssignShifts() {
  const sel = document.getElementById("assignShiftSelect");
  sel.innerHTML = "";
  shifts.forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
  });
}


// =======================================
// 3. THỐNG KÊ & BÁO CÁO
// =======================================
function initReportsUI() {
  const btnCreate = document.getElementById("btnCreateReport");
  if (btnCreate) {
    btnCreate.addEventListener("click", async () => {
      const title = document.getElementById("repTitle")?.value.trim();
      const fromDate = document.getElementById("repFrom")?.value;
      const toDate = document.getElementById("repTo")?.value;

      if (!title || !fromDate || !toDate) {
        alert("Vui lòng nhập đủ tiêu đề và khoảng thời gian.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/reports`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, fromDate, toDate }),
        });
        const json = await res.json();
        if (!json.success)
          throw new Error(json.message || "Tạo báo cáo thất bại");

        document.getElementById("repTitle").value = "";
        document.getElementById("repFrom").value = "";
        document.getElementById("repTo").value = "";
        loadReports();
      } catch (err) {
        console.error("create report error:", err);
        alert("Không tạo được báo cáo");
      }
    });
  }

  const tbody = document.querySelector("#reportTable tbody");
  if (tbody && !tbody._hasReportListener) {
    tbody.addEventListener("click", onReportTableClick);
    tbody._hasReportListener = true;
  }
}

async function loadReports() {
  try {
    const res = await fetch(`${API_BASE}/reports`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Không load được báo cáo");

    reports = json.data || [];
    renderReports(reports);
  } catch (err) {
    console.error("loadReports error:", err);
    alert("Không load được danh sách báo cáo");
  }
}

function renderReports(list) {
  const tbody = document.querySelector("#reportTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = "Chưa có báo cáo nào.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  list.forEach((r) => {
    const tr = document.createElement("tr");
    const range =
      (r.fromDate || "") && (r.toDate || "")
        ? `${r.fromDate} → ${r.toDate}`
        : "";
    tr.innerHTML = `
      <td>${r.title || ""}</td>
      <td>${range}</td>
      <td>${r.status || "pending"}</td>
      <td>${
        r.createdAt ? new Date(r.createdAt).toLocaleString("vi-VN") : ""
      }</td>
      <td>
        ${
          r.status === "pending"
            ? `
          <button class="pill-btn sm" data-action="approve-report" data-id="${r.id}">
            Duyệt
          </button>
          <button class="btn sm outline" data-action="reject-report" data-id="${r.id}">
            Từ chối
          </button>
          `
            : "-"
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function onReportTableClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const reportId = btn.dataset.id;
  const action = btn.dataset.action;
  if (!reportId || !action) return;

  const status = action === "approve-report" ? "approved" : "rejected";
  try {
    const res = await fetch(`${API_BASE}/reports/${encodeURIComponent(reportId)}`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Cập nhật thất bại");
    loadReports();
  } catch (err) {
    console.error("update report status error:", err);
    alert("Không cập nhật được trạng thái báo cáo");
  }
}

// =======================================
// 4. DUYỆT YÊU CẦU
// =======================================
function initRequestsUI() {
  const filter = document.getElementById("reqFilter");
  if (filter) {
    filter.addEventListener("change", () => renderRequests(applyRequestFilter()));
  }

  const tbody = document.querySelector("#reqTable tbody");
  if (tbody) {
    tbody.addEventListener("click", onRequestTableClick);
  }
}

async function loadRequests() {
  try {
    const res = await fetch(`${API_BASE}/requests`, {
      method: "GET",
      headers: getAuthHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Không load được yêu cầu");
    requests = json.data || [];
    renderRequests(applyRequestFilter());
    updateDashboard();
  } catch (err) {
    console.error("loadRequests error:", err);
    alert("Không load được danh sách yêu cầu");
  }
}

function applyRequestFilter() {
  const filter = document.getElementById("reqFilter");
  const value = filter ? filter.value : "all";
  if (value === "all") return requests;

  return requests.filter((r) => r.status === value);
}

function renderRequests(list) {
  const tbody = document.querySelector("#reqTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Không có yêu cầu nào.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // map userId -> name để hiển thị đẹp hơn
  const empMap = {};
  employees.forEach((u) => {
    if (u.id) empMap[u.id] = u.name || u.email || u.id;
  });

  list.forEach((r) => {
    const empName = empMap[r.userId] || r.userId || "";
    const dateShift = r.date
      ? `${r.date}${r.shift ? " - " + r.shift : ""}`
      : r.shift || "";
    const contentParts = [];
    if (r.cin || r.cout) {
      contentParts.push(
        `Giờ đề nghị: ${r.cin || "--"} - ${r.cout || "--"}`
      );
    }
    if (r.note) contentParts.push(r.note);
    const content = contentParts.join(" | ");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${empName}</td>
      <td>${dateShift}</td>
      <td>${r.type || ""}</td>
      <td>${content}</td>
      <td>${r.status || "pending"}</td>
      <td>
        ${
          r.status === "pending"
            ? `
        <button class="pill-btn sm" data-action="approve-req" data-id="${r.id}">
          Duyệt
        </button>
        <button class="btn sm outline" data-action="reject-req" data-id="${r.id}">
          Từ chối
        </button>
        `
            : "-"
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function onRequestTableClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const requestId = btn.dataset.id;
  const action = btn.dataset.action;
  if (!requestId || !action) return;

  const status = action === "approve-req" ? "approved" : "rejected";
  let adminNote = "";
  if (status === "rejected") {
    adminNote = prompt("Lý do từ chối (có thể bỏ trống):") || "";
  }

  try {
    const res = await fetch(
      `${API_BASE}/requests/${encodeURIComponent(requestId)}`,
      {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, adminNote }),
      }
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Cập nhật thất bại");
    loadRequests();
  } catch (err) {
    console.error("update request status error:", err);
    alert("Không cập nhật được yêu cầu");
  }
}

// =======================================
// 5. CÀI ĐẶT VỊ TRÍ CÔNG TY (GPS + MAP)
// =======================================
function initLocationUI() {
  // Khởi tạo map khi vào tab location lần đầu
  const navBtn = document.querySelector('.nav-item[data-route="location"]');
  if (!navBtn) return;

  navBtn.addEventListener("click", () => {
    if (!mapInstance) {
      initLocationMap();
    }
  });

  const btnSave = document.getElementById("btnSaveLocation");
  if (btnSave) {
    btnSave.addEventListener("click", saveCompanyLocation);
  }

  const btnGPS = document.getElementById("btnGPS");
  if (btnGPS) {
    btnGPS.addEventListener("click", useCurrentGPS);
  }
}

function initLocationMap() {
  const mapEl = document.getElementById("map");
  if (!mapEl) return;

  if (!window.google || !google.maps) {
    console.error("Google Maps chưa sẵn sàng");
    alert("Không tải được bản đồ Google Maps.");
    return;
  }

  // Lấy tâm từ input nếu có, không thì default HCM
  const latInput = parseFloat(document.getElementById("company-lat").value);
  const lngInput = parseFloat(document.getElementById("company-lng").value);

  const center = {
    lat: !Number.isNaN(latInput) ? latInput : 10.773,
    lng: !Number.isNaN(lngInput) ? lngInput : 106.7,
  };

  mapInstance = new google.maps.Map(mapEl, {
    center,
    zoom: 13,
    disableDefaultUI: true,
    zoomControl: true,
  });

  // Nếu có sẵn tọa độ thì vẽ luôn marker + circle
  if (!Number.isNaN(latInput) && !Number.isNaN(lngInput)) {
    setMarkerAndCircle(center.lat, center.lng);
  }

  // Click để chọn vị trí
  mapInstance.addListener("click", (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerAndCircle(lat, lng);
  });
}


// Load vị trí hiện tại của công ty từ server
async function loadCompanyLocation() {
  try {
    const res = await fetch(`${API_BASE}/settings/location`, {
      method: "GET",
      headers: getAuthHeaders(true),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Không load được vị trí");

    const data = json.data || {};
    if (data.lat && data.lng) {
      // điền input trước
      document.getElementById("company-lat").value = data.lat;
      document.getElementById("company-lng").value = data.lng;
      document.getElementById("company-radius").value = data.radius || 200;

      if (!mapInstance) {
        initLocationMap();
      }
      const latNum = Number(data.lat);
      const lngNum = Number(data.lng);
      const radiusNum = Number(data.radius) || 200;

      setMarkerAndCircle(latNum, lngNum, radiusNum);

      if (mapInstance && window.google && google.maps) {
        mapInstance.setCenter({ lat: latNum, lng: lngNum });
        mapInstance.setZoom(15);
      }
    }
  } catch (err) {
    console.error("loadCompanyLocation error:", err);
  }
}

function setMarkerAndCircle(lat, lng, radius) {
  if (!mapInstance || !window.google || !google.maps) return;

  const r =
    radius ||
    Number(document.getElementById("company-radius").value) ||
    200;

  // Xoá marker / circle cũ
  if (marker) {
    marker.setMap(null);
    marker = null;
  }
  if (circle) {
    circle.setMap(null);
    circle = null;
  }

  const position = { lat, lng };

  marker = new google.maps.Marker({
    map: mapInstance,
    position,
    draggable: true,
  });

  circle = new google.maps.Circle({
    map: mapInstance,
    center: position,
    radius: r,
    strokeColor: "#00aaff",
    strokeOpacity: 0.9,
    strokeWeight: 1,
    fillColor: "#00aaff",
    fillOpacity: 0.15,
  });

  // cập nhật input khi kéo marker
  marker.addListener("dragend", () => {
    const pos = marker.getPosition();
    const pLat = pos.lat();
    const pLng = pos.lng();
    document.getElementById("company-lat").value = pLat.toFixed(6);
    document.getElementById("company-lng").value = pLng.toFixed(6);
    if (circle) {
      circle.setCenter({ lat: pLat, lng: pLng });
    }
  });

  // cập nhật input khi chọn điểm
  document.getElementById("company-lat").value = lat.toFixed(6);
  document.getElementById("company-lng").value = lng.toFixed(6);
}

function syncInputsFromMarker() {
  if (!marker || !window.google || !google.maps) return;
  const pos = marker.getPosition();
  const lat = pos.lat();
  const lng = pos.lng();
  document.getElementById("company-lat").value = lat.toFixed(6);
  document.getElementById("company-lng").value = lng.toFixed(6);
}

async function saveCompanyLocation() {
  try {
    const lat = parseFloat(document.getElementById("company-lat").value);
    const lng = parseFloat(document.getElementById("company-lng").value);
    const radius = parseFloat(document.getElementById("company-radius").value);

    if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
      alert("Vui lòng nhập đầy đủ lat, lng, radius hợp lệ.");
      return;
    }

    console.log("Sending:", lat, lng, radius);

    const res = await fetch(`${API_BASE}/settings/location`, {
      method: "POST",
      headers: getAuthHeaders(true),       // <<< FIX QUAN TRỌNG
      body: JSON.stringify({ lat, lng, radius }),
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message || "Lưu vị trí thất bại");

    alert("Đã lưu vị trí công ty!");
  } catch (err) {
    console.error("saveCompanyLocation error:", err);
    alert("Không lưu được vị trí công ty");
  }
}


function useCurrentGPS() {
  if (!navigator.geolocation) {
    alert("Trình duyệt không hỗ trợ GPS.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      document.getElementById("company-lat").value = lat.toFixed(6);
      document.getElementById("company-lng").value = lng.toFixed(6);

      if (!mapInstance) {
        initLocationMap();
      }
      setMarkerAndCircle(lat, lng);

      if (mapInstance && window.google && google.maps) {
        mapInstance.setCenter({ lat, lng });
        mapInstance.setZoom(16);
      }
    },
    (err) => {
      console.error("GPS error:", err);
      alert("Không lấy được GPS hiện tại.");
    }
  );
}

// =======================================
// Dashboard nhỏ bên phải
// =======================================
function updateDashboard() {
  const totalEmpEl = document.getElementById("mgrTotalEmployees");
  const totalAssignEl = document.getElementById("mgrTotalAssignments");
  const pendingReqEl = document.getElementById("mgrPendingRequests");

  if (totalEmpEl) totalEmpEl.textContent = String(employees.length || 0);
  // Tạm dùng số ca làm như số lượt gán ca (nếu cần sau chỉnh lại theo user_shifts)
  if (totalAssignEl) totalAssignEl.textContent = String(shifts.length || 0);
  if (pendingReqEl)
    pendingReqEl.textContent = String(
      (requests || []).filter((r) => r.status === "pending").length
    );
}
function initMiniCalendar() {
  const root = document.getElementById("miniCal");
  if (!root) return;

  const now = new Date();
  let curY = now.getFullYear();
  let curM = now.getMonth();

  function render() {
    root.innerHTML = `
      <div class="mini-cal-head">
        <button id="calPrev" class="icon-btn">‹</button>
        <strong>${curM+1}/${curY}</strong>
        <button id="calNext" class="icon-btn">›</button>
      </div>
      <div class="mini-cal-grid" id="miniGrid"></div>
    `;

    const grid = root.querySelector("#miniGrid");
    const headers = ["T2","T3","T4","T5","T6","T7","CN"];

    headers.forEach(h => {
      const th = document.createElement("div");
      th.textContent = h;
      th.style = "font-weight:600;text-align:center;font-size:13px;";
      grid.appendChild(th);
    });

    const first = new Date(curY, curM, 1);
    let startIndex = (first.getDay()+6)%7;
    const days = new Date(curY, curM+1, 0).getDate();

    for (let i=0;i<startIndex;i++){
      grid.appendChild(document.createElement("div"));
    }

    for (let d=1; d<=days; d++){
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = d;

      const dateStr = `${curY}-${String(curM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

      if (selectedDate === dateStr) {
        cell.classList.add("selected");
      }

      cell.addEventListener("click", () => {
        selectedDate = dateStr;
        render();
      });

      grid.appendChild(cell);
    }

    root.querySelector("#calPrev").onclick = () => {
      curM--;
      if (curM < 0) { curM = 11; curY--; }
      render();
    };

    root.querySelector("#calNext").onclick = () => {
      curM++;
      if (curM > 11) { curM = 0; curY++; }
      render();
    };
  }

  render();
}
