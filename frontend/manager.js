const API_BASE = "https://timekeeping-gr3.onrender.com/api";

let token = null;
let currentUser = null;

let employees = [];
let shifts = [];
let reports = [];

let mapInstance = null;
let marker = null;
let circle = null;
let editingEmpId = null;
let currentEditShiftId = null;
let shiftCache = {};
let allShifts = [];
let editingShiftUserIds = [];
let originalShiftUserIds = [];
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
document.addEventListener("DOMContentLoaded", async () => {
  currentUser = loadCurrentUser();
  flatpickr("#shiftDate", {
    dateFormat: "Y-m-d",
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
  initLocationUI();
  initMiniCalendar();

  //loadReports();
  loadCompanyLocation();
  await loadEmployees();
  await loadShifts();

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
      localStorage.removeItem("tkUser");
      window.location.href = "auth.html";
    }
  });
}

// =======================================
// 1. QUẢN LÝ NHÂN VIÊN
// =======================================
function initEmployeesUI() {
  const reloadBtn = document.getElementById("btnReloadEmployees");
  if (reloadBtn) {
  reloadBtn.addEventListener("click", async () => {
    reloadBtn.classList.add("spin-once");

    // Chờ animation xoay xong (450ms)
    setTimeout(async () => {
      await loadEmployees();     // load lại sau khi xoay
      reloadBtn.classList.remove("spin-once");
    }, 450);
  });
}

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
  document.querySelector("#empTable").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const userId = btn.dataset.id;

    if (action === "edit") openEditEmployee(userId);
    if (action === "toggle") toggleEmployeeStatus(userId);
    if (action === "delete") deleteEmployee(userId);
  });

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
  // ====== Gắn sự kiện cho modal Edit ======
    const btnClose = document.getElementById("btnCloseEditEmp");
    if (btnClose) {
      btnClose.onclick = () => {
        document.getElementById("editEmpModal").classList.add("hidden");
        editingEmpId = null;
      };
    }

    const btnSave = document.getElementById("btnSaveEmp");
    if (btnSave) {
      btnSave.onclick = saveEmployeeEdits;
    }

    // NÚT XOÁ tài khoản
    const btnDelete = document.getElementById("btnDeleteEmp");
      if (btnDelete) {
        btnDelete.onclick = () => {
          if (!editingEmpId) {
            alert("Không có nhân viên nào đang được chọn.");
            return;
          }
          deleteEmployee(editingEmpId);
        };
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
  tbody.innerHTML = "";

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Chưa có nhân viên.</td></tr>`;
    return;
  }

  list.forEach((u) => {
    const acc = (u.accountStatus || "").toLowerCase();
    const isActive = acc === "active";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.employeeCode}</td>


      <td>${u.name}</td>
      <td>${u.email}</td>
      <td>${u.dept || "-"}</td>
      <td>${u.status === "active" ? "Đang hoạt động" : "Đã khoá"}</td>

      <td class="actions">
        <button class="pill-btn sm blue" 
                data-action="edit" 
                data-id="${u.id}">
          Cập nhật
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Sửa thông tin nhân viên (dùng prompt đơn giản)
function openEditEmployee(userId) {
  const user = employees.find(u => u.id === userId);
  if (!user) return;

  editingEmpId = user.id;

  document.getElementById("editEmpName").value = user.name || "";
  document.getElementById("editEmpEmail").value = user.email || "";
  document.getElementById("editEmpDept").value = user.dept || "";
  document.getElementById("editEmpStatus").value = user.status || "active";

  document.getElementById("editEmpModal").classList.remove("hidden");
}

async function toggleEmployeeStatus(userId) {
  const user = employees.find((u) => u.id === userId);
  if (!user) return;

  const newStatus = user.status === "active" ? "inactive" : "active";

  await fetch(`${API_BASE}/users/${user.id}`, {
    method: "PATCH",
    headers: getAuthHeaders(true),
    body: JSON.stringify({ status: newStatus }),
  });

  loadEmployees();
}

async function saveEmployeeEdits() {
  if (!editingEmpId) return;

  const payload = {
    name: document.getElementById("editEmpName").value.trim(),
    email: document.getElementById("editEmpEmail").value.trim(),
    dept: document.getElementById("editEmpDept").value.trim(),
    status: document.getElementById("editEmpStatus").value
  };

  try {
    const res = await fetch(`${API_BASE}/users/${editingEmpId}`, {
      method: "PATCH",
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    alert("Cập nhật thành công!");
    document.getElementById("editEmpModal").classList.add("hidden");

    loadEmployees();
  } catch (err) {
    alert("Lỗi cập nhật: " + err.message);
  }
}

async function deleteEmployee(userId) {
  const user = employees.find(u => u.id === userId);
  if (!user) return;

  if (user.status !== "inactive") {
    alert("Chỉ xóa được nhân viên đã bị khóa.");
    return;
  }

  if (!confirm(`Xóa nhân viên: ${user.employeeCode} – ${user.name}?`)) return;

  await fetch(`${API_BASE}/users/${user.id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  loadEmployees();
}

// =======================================
// 2. QUẢN LÝ CA LÀM
// =======================================
function initShiftsUI() {
  const shiftSearch = document.getElementById("searchShift");

  shiftSearch.addEventListener("input", () => {
    let keyword = shiftSearch.value.trim().toLowerCase();

    if (!keyword) {
        shifts = allShifts;
        return renderShifts(shifts);
    }

    // ⭐ Nếu người dùng nhập dạng 11/12 → chuyển thành dạng 12-11 hoặc tìm trong month
    let convertedKeyword = keyword;
    if (keyword.includes("/")) {
        const parts = keyword.split("/");
        if (parts.length === 2) {
            const dd = parts[0].padStart(2, "0");
            const mm = parts[1].padStart(2, "0");

            // dạng 11/12 → tìm theo “-12-11” cho khớp yyyy-mm-dd
            convertedKeyword = `-${mm}-${dd}`;
        }
    }

    const filtered = allShifts.filter(s =>
        (s.date || "").toLowerCase().includes(convertedKeyword) ||
        (s.shiftCode || "").toLowerCase().includes(keyword) ||
        (s.name || "").toLowerCase().includes(keyword)
    );

    shifts = filtered;
    renderShifts(filtered);
});
  const reloadBtn = document.getElementById("btnReloadShift");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", async () => {
      reloadBtn.classList.add("spin-once");

      // Chờ animation xoay xong (450ms)
      setTimeout(async () => {
        await loadShifts(null, true);     // load lại sau khi xoay
        reloadBtn.classList.remove("spin-once");
      }, 450);
    });
  }


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
        const today = new Date();
        const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
        await loadShifts();
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

async function loadShifts(monthKey,forceReload = false) {
  // 1️⃣ Nếu không truyền monthKey → mặc định tháng hiện tại
  if (!monthKey) {
    const today = new Date();
    monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  }
  if (!forceReload && shiftCache[monthKey]) {
    shifts = shiftCache[monthKey];
    renderShifts(shifts);
    updateDashboard();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/shifts?month=${monthKey}`, {
      headers: getAuthHeaders(),
      cache: "no-store",
    });
    const data = await res.json();

    shifts = data.success && Array.isArray(data.data) ? data.data : [];
    shiftCache[monthKey] = shifts;
    allShifts = shifts;

    renderShifts(shifts);
    updateDashboard();
  } catch (err) {
    console.error("loadShifts error:", err);
    shifts = [];
    renderShifts([]);
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
        <td>${s.shiftCode || s.id.slice(0, 6)}</td>
        <td>${s.name || ""}</td>
        <td>${s.startTime || ""}</td>
        <td>${s.endTime || ""}</td>
        <td>${s.employeeCount ?? "0"} người </td>
        <td>
          <button class="btn outline" onclick="openEditShift('${s.id}')">Xem</button>
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

  loadAssignShifts();

  const dateInput = document.getElementById("assignDate");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().slice(0, 10);
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
    if (selectedShiftId === s.id) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
}

async function onAssignConfirm() {
  const userSel = document.getElementById("assignUser");
  const shiftSel = document.getElementById("assignShiftSelect");
  const dateInput = document.getElementById("assignDate");

  if (!userSel || !shiftSel || !dateInput) return;

  const userIds = Array.from(userSel.selectedOptions).map(o => o.value);
  const shiftIds = Array.from(shiftSel.selectedOptions).map(o => o.value);
  const date = dateInput.value;

  if (!userIds.length) return alert("Chọn ít nhất 1 nhân viên");
  if (!shiftIds.length) return alert("Chọn ít nhất 1 ca");
  if (!date) return alert("Chọn ngày");

  try {
    await assignShifts({ userIds, shiftIds, date });
    alert("Đã gán ca thành công");
    document.getElementById("assignModal")?.classList.add("hidden");
    await loadShifts(null, true);
  } catch (err) {
    alert(err.message);
  }
}

async function assignShifts({ userIds, shiftIds, date }) {
  const res = await fetch(`${API_BASE}/shifts/assign`, {
    method: "POST",
    headers: getAuthHeaders(true),
    body: JSON.stringify({
      userIds,
      shiftIds,
      date
    })
  });

  const json = await res.json();

  if (!json.success) {
    throw new Error(json.message || "Gán ca thất bại");
  }

  return json.data;
}
async function saveShiftChanges() {
  try {
    const rawDate = document.getElementById("editShiftDate").value;
    const date = rawDate.includes("/")
  ? toInputDateFormat(rawDate)
  : rawDate;
    const startTime = document.getElementById("editShiftStart").value;
    const endTime = document.getElementById("editShiftEnd").value;

    // 1️⃣ Update ca
    await fetch(`${API_BASE}/shifts/${currentEditShiftId}`, {
      method: "PUT",
      headers: getAuthHeaders(true),
      body: JSON.stringify({ date, startTime, endTime })
    });

    // 2️⃣ Gán nhân viên (nếu có)
    const newUserIds = editingShiftUserIds.filter(
      id => !originalShiftUserIds.includes(id)
    );

    if (newUserIds.length > 0) {
      await assignShifts({
        userIds: newUserIds,
        shiftIds: [currentEditShiftId],
        date
      });
    }

    alert("Đã lưu thay đổi");
    closeEditShiftModal();
    await loadShifts(null, true);

  } catch (err) {
    alert(err.message);
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-close-modal]");
  if (!btn) return;

  const modalId = btn.dataset.closeModal;
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
});

// =======================================
// 3. THỐNG KÊ & BÁO CÁO (FLOW MỚI — CLEAN)
// =======================================

let _allEmployees = [];
let _allDetailRows = [];

function initReportsUI() {
  const monthInput = document.getElementById("repMonth");
  const btnExport = document.getElementById("btnLoadSummary");
  const btnRefresh = document.getElementById("btnReloadReports");

  document.getElementById("employeeSearchBox")?.addEventListener("input", () => {
    renderEmployeeSummary(_allEmployees);
  });

  // Điều hướng sang tab ca làm khi cần
  const gotoShiftTab = document.getElementById("gotoShiftTab");
  if (gotoShiftTab) {
    gotoShiftTab.style.cursor = "pointer";
    gotoShiftTab.addEventListener("click", () => {
      document.querySelector('.nav-item[data-route="shifts"]')?.click();
    });
  }

  // Set tháng mặc định
  if (monthInput && !monthInput.value) {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    monthInput.value = `${now.getFullYear()}-${m}`;
  }

  // Load ngay khi vào tab
  loadSummaryByMonth();

  // Khi đổi tháng → load summary mới
  monthInput.addEventListener("change", loadSummaryByMonth);

  // Refresh
  if (btnRefresh) btnRefresh.addEventListener("click", loadSummaryByMonth);

  // Export PDF
  btnExport.addEventListener("click", exportSummaryPDF);
}


// -------------------------------
// Load Summary theo tháng
// -------------------------------
function loadSummaryByMonth() {
  const mv = document.getElementById("repMonth").value;
  if (!mv) return;

  const [y, m] = mv.split("-");
  const from = `${y}-${m}-01`;
  const to = `${y}-${m}-31`;

  loadMonthlySummary(from, to);
}


// -------------------------------
// Gọi API summary
// -------------------------------
async function loadMonthlySummary(from, to) {
  try {
    const res = await fetch(`${API_BASE}/reports/summary?from=${from}&to=${to}`, {
      headers: getAuthHeaders(false),
    });
    const json = await res.json();

    if (!json.success) throw new Error("API error");

    const data = json.data || {};

    // Tổng quan
    document.getElementById("sumTotal").textContent = data.totalAssignments ?? 0;
    document.getElementById("sumPresent").textContent = data.present ?? 0;
    document.getElementById("sumAbsent").textContent = data.absent ?? 0;
    document.getElementById("sumRate").textContent =
      ((data.attendanceRate || 0) * 100).toFixed(0) + "%";

    // Lưu danh sách nhân viên & chi tiết
    _allEmployees = data.employees || [];
    _allDetailRows = data.details || [];

    renderEmployeeSummary(_allEmployees);
    initSummaryCardEvents();

  } catch (err) {
    console.error("loadMonthlySummary error:", err);
  }
}


// -------------------------------
// Sự kiện click các card (clean)
// -------------------------------
function initSummaryCardEvents() {
  document.getElementById("gotoPresentList")?.addEventListener("click", openPresentModal);
  document.getElementById("gotoAbsentList")?.addEventListener("click", openAbsentModal);
  document.getElementById("gotoRate")?.addEventListener("click", openRateModal);
}


// -------------------------------
// Render danh sách nhân viên (cards)
// -------------------------------
function renderEmployeeSummary(list) {
  const wrap = document.getElementById("employeeSummaryTable");
  const keyword = document.getElementById("employeeSearchBox")?.value?.toLowerCase() || "";

  const filtered = list.filter(u => u.name?.toLowerCase().includes(keyword));

  if (!filtered.length) {
    wrap.innerHTML = `<p style="padding:12px;">Không có nhân viên nào.</p>`;
    return;
  }

  let html = `<div class="emp-card-grid">`;

  filtered.forEach(u => {
    const rate = u.assigned ? Math.round((u.present / u.assigned) * 100) : 0;
    html += `
      <div class="emp-card" data-user-id="${u.userId}">
        <div class="emp-info">
          <h4>${u.employeeCode} – ${u.name}</h4>

          <p class="emp-role">Nhân viên</p>
        </div>

        <div class="emp-stats">
          <div><strong>${u.assigned}</strong><span>Tổng ca</span></div>
          <div><strong>${u.present}</strong><span>Đi làm</span></div>
          <div><strong>${u.absent}</strong><span>Vắng</span></div>
          <div><strong>${rate}%</strong><span>Tỉ lệ</span></div>
        </div>

        <button class="pill-btn emp-detail-btn" data-user-id="${u.userId}">
          Xem chi tiết
        </button>
      </div>
    `;
  });

  wrap.innerHTML = html;

  // Gắn event xem chi tiết
  wrap.querySelectorAll(".emp-detail-btn").forEach(btn => {
    btn.addEventListener("click", () => openEmployeeDetailModal(btn.dataset.userId));
  });
}


// -------------------------------
// Modal chi tiết nhân viên
// -------------------------------
function openEmployeeDetailModal(userId) {
  const modal = document.getElementById("empDetailModal");
  const nameEl = document.getElementById("detailEmpName");
  const tableWrap = document.getElementById("empDetailTableWrap");

  const emp = _allEmployees.find(e => e.userId === userId);

  nameEl.textContent = `Chi tiết – ${emp.employeeCode} – ${emp.name}`;

  const rows = _allDetailRows.filter(r => r.userId === userId);
  tableWrap.innerHTML = buildDetailTableHTML(rows);

  modal.classList.remove("hidden");

  document.getElementById("btnCloseEmpDetail").onclick = () =>
    modal.classList.add("hidden");
}


// -------------------------------
// Build bảng chi tiết (reusable)
// -------------------------------
function buildDetailTableHTML(rows) {
  if (!rows || !rows.length) {
    return "<p>Không có dữ liệu ca làm.</p>";
  }

  let html = `
    <table class="table">
      <thead>
        <tr>
          <th>Ngày</th>
          <th>Nhân viên</th>
          <th>Ca làm</th>
          <th>Giờ ca</th>
          <th>Check-in</th>
          <th>Check-out</th>
          <th>Giờ làm</th>
          <th>Đi muộn / về sớm</th>
          <th>Lỗi chấm công</th>
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach(r => {
    const late = r.isLate ? `Muộn ${r.lateMinutes}p` : "";
    const early = r.isEarly ? `Sớm ${r.earlyMinutes}p` : "";
    const status = [late, early].filter(Boolean).join(" · ") || "-";

    const errs = [];
    if (r.missingCheckIn) errs.push("Không check-in");
    if (r.missingCheckOut) errs.push("Không check-out");
    if (r.checkoutWithoutCheckin) errs.push("Checkout không checkin");

    html += `
      <tr>
        <td>${r.date}</td>
        <td>${r.userName}</td>
        <td>${r.shiftName || "-"}</td>
        <td>${r.shiftStart} - ${r.shiftEnd}</td>
        <td>${r.checkInAt ? formatTime(r.checkInAt) : "-"}</td>
        <td>${r.checkOutAt ? formatTime(r.checkOutAt) : "-"}</td>
        <td>${r.workHours || 0}</td>
        <td>${status}</td>
        <td>${errs.length ? errs.join(", ") : "-"}</td>
      </tr>
    `;
  });

  return html + `</tbody></table>`;
}

function formatTime(t) {
  return new Date(t).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}


// -------------------------------
// Present / Absent / Rate modals
// -------------------------------
function openPresentModal() {
  const list = document.getElementById("presentList");
  const items = _allEmployees.filter(e => e.present > 0);

  list.innerHTML = items.length
    ? items.map(e => `<li>${e.name} – ${e.present}/${e.assigned}</li>`).join("")
    : "<li>Không có nhân viên nào đi làm.</li>";

  document.getElementById("presentModal").classList.remove("hidden");
}

function openAbsentModal() {
  const list = document.getElementById("absentList");
  const items = _allEmployees.filter(e => e.absent > 0);

  list.innerHTML = items.length
    ? items.map(e => `<li>${e.name} – ${e.absent}/${e.assigned}</li>`).join("")
    : "<li>Không có nhân viên nào vắng.</li>";

  document.getElementById("absentModal").classList.remove("hidden");
}

function openRateModal() {
  const list = document.getElementById("rateList");

  list.innerHTML = _allEmployees
    .map(e => {
      const rate = ((e.attendanceRate || 0) * 100).toFixed(0);
      return `<li>${e.name} – ${rate}% (${e.present}/${e.assigned})</li>`;
    })
    .join("");

  document.getElementById("rateModal").classList.remove("hidden");
}


// -------------------------------
// Xuất PDF
// -------------------------------
async function exportSummaryPDF() {
  const mv = document.getElementById("repMonth").value;
  const [y, m] = mv.split("-");
  const from = `${y}-${m}-01`;
  const to = `${y}-${m}-31`;

  const url = `${API_BASE}/reports/summary/pdf?from=${from}&to=${to}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
  if (!res.ok) return alert("Xuất báo cáo thất bại!");

  const blob = await res.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `BaoCao-${from}-to-${to}.pdf`;
  link.click();
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

  if (totalEmpEl) totalEmpEl.textContent = String(employees.length || 0);
  // Tạm dùng số ca làm như số lượt gán ca (nếu cần sau chỉnh lại theo user_shifts)
  if (totalAssignEl) totalAssignEl.textContent = String(shifts.length || 0);
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
function toInputDateFormat(d) {
  // d = "29/11/2025"
  const [day, month, year] = d.split("/");
  return `${year}-${month}-${day}`;
}

async function openEditShift(shiftId) {
  currentEditShiftId = shiftId;

  // Lấy thông tin ca
  const res = await fetch(`${API_BASE}/shifts/${shiftId}`, {
    headers: getAuthHeaders()
  });
  const data = await res.json();
  if (!data.success) return alert(data.message);

  const shift = data.data;
  originalShiftUserIds = shift.userIds ? [...shift.userIds] : [];
  editingShiftUserIds = [...originalShiftUserIds];
  // Gán thông tin vào form
  document.getElementById("editShiftDate").value = toInputDateFormat(shift.date);

  document.getElementById("editShiftStart").value = shift.startTime;
  document.getElementById("editShiftEnd").value = shift.endTime;

  // Load danh sách nhân viên để thêm
  loadEmployeeDropdown();

  document.getElementById("editShiftModal").classList.remove("hidden");
}

function closeEditShiftModal() {
  document.getElementById("editShiftModal").classList.add("hidden");
  editingShiftUserIds = [];
  originalShiftUserIds = [];
  currentEditShiftId = null;
}

async function loadEmployeeDropdown() {
  const sel = document.getElementById("editShiftAddEmployee");
  if (!sel) return;

  sel.innerHTML = `<option value="">Chọn nhân viên</option>`;

  employees
    .filter((u) => u.role !== "admin" && u.role !== "System Admin")
    .forEach((u) => {
      sel.innerHTML += `<option value="${u.id}">${u.name}</option>`;
    });
}

function addEmployeeToEditingShift(userId) {
  if (!editingShiftUserIds.includes(userId)) {
    editingShiftUserIds.push(userId);
  }
}