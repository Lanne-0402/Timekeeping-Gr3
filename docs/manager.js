// ===== DEMO DATA =====
let employees = [
  {
    id:'NV001',
    name:'Nguyễn Ngọc Gia Hân',
    dept:'Kinh doanh',
    role:'Nhân viên',
    status:'active',
    shifts:['Sáng','Chiều'],
    stats:{work:22, off:2, late:1}
  },
  {
    id:'NV002',
    name:'Nông Thị Hồng Lan',
    dept:'Kỹ thuật',
    role:'Kỹ sư',
    status:'active',
    shifts:['Sáng'],
    stats:{work:20, off:4, late:2}
  },
  {
    id:'NV003',
    name:'Lê Thị Bảo Diệp',
    dept:'Nhân sự',
    role:'Chuyên viên',
    status:'inactive',
    shifts:['Chiều'],
    stats:{work:5, off:19, late:0}
  }
];

// Các loại ca chuẩn
const shiftTypes = [
  { name:'Sáng',  start:'08:00', end:'12:00' },
  { name:'Chiều', start:'13:00', end:'17:00' }
];

// Demo yêu cầu từ nhân viên
let reviewRequests = [
  {
    id:1,
    emp:'Nguyễn Ngọc Gia Hân',
    date:'2025-11-03',
    shift:'Sáng',
    type:'Chỉnh sửa',
    content:'Xin chỉnh lại giờ check-in 08:05 thành 08:00 vì hệ thống lỗi.',
    status:'pending'
  },
  {
    id:2,
    emp:'Lê Thị Bảo Diệp',
    date:'2025-11-04',
    shift:'Chiều',
    type:'Khiếu nại',
    content:'Bị ghi nhận vắng nhưng có xin phép nghỉ có lương.',
    status:'approved'
  }
];

let editingEmpId = null;

document.addEventListener("DOMContentLoaded", () => {
  // ===== Kiểm tra đăng nhập & role =====
  const rawUser = localStorage.getItem("tkUser");
  if (!rawUser) {
    window.location.href = "auth.html";
    return;
  }
  const user = JSON.parse(rawUser);

  // chỉ cho phép role = manager vào trang này
  if (user.role !== "manager") {
    window.location.href = "auth.html";
    return;
  }

  // hiện tên quản lý
  const mgrName = document.getElementById("mgrName");
  if (mgrName) mgrName.textContent = user.name || "Manager";

  // ===== Nút đăng xuất =====
  const mgrLogout = document.getElementById("mgrLogout");
  mgrLogout?.addEventListener("click", () => {
    localStorage.removeItem("tkUser");
    window.location.href = "auth.html";
  });

  // ===== Sidebar nav (bỏ qua nút không có data-route, ví dụ Đăng xuất) =====
  document.querySelectorAll(".nav-item").forEach(btn => {
    const route = btn.dataset.route;
    if (!route) return;
    btn.addEventListener("click", () => gotoRoute(route, btn));
  });

  // Quản lý nhân viên
  renderEmployees();
  setupEmployeeModal();

  // Quản lý ca làm
  fillShiftSelectors();
  renderShiftAssignments();
  document.getElementById("btnAssignShift")
    ?.addEventListener("click", assignShiftToEmployee);

  // Thống kê
  renderReportList();
  document.getElementById("btnExport")
    ?.addEventListener("click", ()=> alert("Giả lập xuất báo cáo (thực tế sẽ tải file Excel / PDF)."));
  document.getElementById("reportDept")
    ?.addEventListener("change", renderReportList);

  // Duyệt yêu cầu
  document.getElementById("reqFilterStatus")
    ?.addEventListener("change", renderReviewRequests);
  renderReviewRequests();

  // Tổng quan
  updateOverview();

  // ===== CÀI ĐẶT: ĐỔI MẬT KHẨU (DEMO) =====
  const mgrChangeForm = document.getElementById("mgrChangePassForm");
  if (mgrChangeForm) {
    mgrChangeForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const oldPass  = document.getElementById("mgrOldPass").value;
      const newPass  = document.getElementById("mgrNewPass").value;
      const newPass2 = document.getElementById("mgrNewPass2").value;
      const errBox   = document.getElementById("mgrPassError");

      errBox.style.display = "none";
      errBox.textContent   = "";

      // user đang đăng nhập (demo)
      const raw = localStorage.getItem("tkUser");
      let currentUser = raw ? JSON.parse(raw) : null;

      // trong demo, mật khẩu gốc là currentUser.password nếu có, không thì 123456
      const realCurrent = currentUser?.password || "123456";

      if (oldPass !== realCurrent) {
        errBox.textContent = "Mật khẩu hiện tại không đúng (demo).";
        errBox.style.display = "block";
        return;
      }

      if (newPass.length < 6) {
        errBox.textContent = "Mật khẩu mới phải ít nhất 6 ký tự.";
        errBox.style.display = "block";
        return;
      }

      if (newPass !== newPass2) {
        errBox.textContent = "Mật khẩu nhập lại không khớp.";
        errBox.style.display = "block";
        return;
      }

      // Demo: chỉ cập nhật mật khẩu trong tkUser ở localStorage
      if (currentUser) {
        currentUser.password = newPass;
        localStorage.setItem("tkUser", JSON.stringify(currentUser));
      }

      alert("Đã đổi mật khẩu.");
      mgrChangeForm.reset();
    });
  }
});

// ==== Router ====
function gotoRoute(route, btn){
  document.querySelectorAll(".route")
    .forEach(sec => sec.classList.toggle("hidden", sec.id !== route));
  document.querySelectorAll(".nav-item")
    .forEach(b => b.classList.toggle("active", b === btn));
}

// ==== Overview right panel ====
function updateOverview(){
  document.getElementById("mgrTotalEmployees").textContent = employees.length;
  const totalAssignments = employees.reduce((sum,e)=> sum + (e.shifts?.length || 0), 0);
  document.getElementById("mgrTotalAssignments").textContent = totalAssignments;
  document.getElementById("mgrPendingRequests").textContent =
    reviewRequests.filter(r => r.status === "pending").length;
}

// ==== EMPLOYEES ====
function renderEmployees(){
  const tbody = document.querySelector("#empTable tbody");
  const searchEl = document.getElementById("empSearch");
  const deptEl = document.getElementById("empDeptFilter");

  const keyword = searchEl?.value?.toLowerCase() || "";
  const deptFilter = deptEl?.value || "";

  let data = employees.filter(e =>
    (e.name.toLowerCase().includes(keyword) || e.id.toLowerCase().includes(keyword))
    && (!deptFilter || e.dept === deptFilter)
  );

  if (data.length === 0){
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:14px;">Không có nhân viên phù hợp</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(e => `
    <tr>
      <td>${e.id}</td>
      <td>${e.name}</td>
      <td>${e.dept}</td>
      <td>${e.role || ""}</td>
      <td>
        <span class="badge ${e.status==='active'?'active':'inactive'}">
          ${e.status==='active'?'Đang làm':'Nghỉ việc'}
        </span>
      </td>
      <td class="actions">
        <button class="btn sm outline" data-action="edit" data-id="${e.id}">Sửa</button>
        <button class="btn sm close" data-action="delete" data-id="${e.id}">Xóa</button>
      </td>
    </tr>
  `).join("");

  // Gán event cho nút Sửa / Xóa
  tbody.querySelectorAll("button[data-action='edit']").forEach(btn=>{
    btn.addEventListener("click", ()=> openEmpDialog(btn.dataset.id));
  });
  tbody.querySelectorAll("button[data-action='delete']").forEach(btn=>{
    btn.addEventListener("click", ()=> deleteEmployee(btn.dataset.id));
  });

  // cập nhật selector ở màn ca làm & báo cáo
  fillShiftSelectors();
  renderShiftAssignments();
  renderReportList();
  updateOverview();
}

function setupEmployeeModal(){
  const dialog = document.getElementById("empDialog");
  const form   = document.getElementById("empForm");
  const cancel = document.getElementById("empCancel");
  const btnNew = document.getElementById("btnEmpNew");
  const search = document.getElementById("empSearch");
  const deptFilter = document.getElementById("empDeptFilter");

  btnNew?.addEventListener("click", ()=> openEmpDialog(null));
  cancel?.addEventListener("click", ()=> dialog.close());
  search?.addEventListener("input", renderEmployees);
  deptFilter?.addEventListener("change", renderEmployees);

  form?.addEventListener("submit", (e)=>{
    e.preventDefault();
    const emp = {
      id: document.getElementById("empId").value.trim(),
      name: document.getElementById("empNameInput").value.trim(),
      dept: document.getElementById("empDept").value,
      role: document.getElementById("empRole").value.trim(),
      status: document.getElementById("empStatus").value,
    };

    if (!emp.id || !emp.name){
      alert("Vui lòng nhập đầy đủ Mã nhân viên và Họ tên.");
      return;
    }

    if (editingEmpId){
      const idx = employees.findIndex(e => e.id === editingEmpId);
      if (idx !== -1){
        emp.shifts = employees[idx].shifts || [];
        emp.stats  = employees[idx].stats || {work:0,off:0,late:0};
        employees[idx] = emp;
      }
    }else{
      if (employees.some(e => e.id === emp.id)){
        alert("Mã nhân viên đã tồn tại.");
        return;
      }
      emp.shifts = [];
      emp.stats = {work:0,off:0,late:0};
      employees.push(emp);
    }

    dialog.close();
    form.reset();
    editingEmpId = null;
    renderEmployees();
  });
}

function openEmpDialog(id){
  const dialog = document.getElementById("empDialog");
  const formTitle = document.getElementById("empFormTitle");
  const idInput = document.getElementById("empId");
  const nameInput = document.getElementById("empNameInput");
  const deptSelect = document.getElementById("empDept");
  const roleInput = document.getElementById("empRole");
  const statusSelect = document.getElementById("empStatus");

  // reset trước
  document.getElementById("empForm").reset();

  if(id){
    const emp = employees.find(e => e.id === id);
    if(!emp) return;
    editingEmpId = id;
    formTitle.textContent = "Sửa thông tin nhân viên";

    idInput.value = emp.id;
    nameInput.value = emp.name;
    deptSelect.value = emp.dept;
    roleInput.value = emp.role || "";
    statusSelect.value = emp.status;
  }else{
    editingEmpId = null;
    formTitle.textContent = "Thêm nhân viên";
  }

  dialog.showModal();
}

function deleteEmployee(id){
  if (!confirm("Bạn có chắc muốn xóa nhân viên này?")) return;
  employees = employees.filter(e => e.id !== id);
  renderEmployees();
}

// ==== SHIFTS ====
function fillShiftSelectors(){
  const empSelect = document.getElementById("shiftEmpSelect");
  const typeSelect = document.getElementById("shiftTypeSelect");
  if(!empSelect || !typeSelect) return;

  empSelect.innerHTML = employees.map(e =>
    `<option value="${e.id}">${e.id} - ${e.name}</option>`).join("");

  typeSelect.innerHTML = shiftTypes.map(s =>
    `<option value="${s.name}">${s.name} (${s.start} - ${s.end})</option>`).join("");
}

function renderShiftAssignments(){
  const tbody = document.querySelector("#shiftTable tbody");
  if(!tbody) return;

  if (employees.length === 0){
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:14px;">Chưa có nhân viên</td></tr>`;
    return;
  }

  tbody.innerHTML = employees.map(e => {
    const shifts = e.shifts && e.shifts.length
      ? e.shifts.map(sh => `<span class="chip" data-emp="${e.id}" data-shift="${sh}">${sh}<button type="button">✕</button></span>`).join("")
      : '<span class="muted">Chưa gán ca</span>';

    return `
      <tr>
        <td>${e.id}</td>
        <td>${e.name}</td>
        <td>${e.dept}</td>
        <td>${shifts}</td>
      </tr>`;
  }).join("");

  // gán sự kiện xóa từng ca
  tbody.querySelectorAll(".chip").forEach(chip=>{
    const empId = chip.dataset.emp;
    const shift = chip.dataset.shift;
    chip.querySelector("button").addEventListener("click", ()=>{
      removeShiftFromEmployee(empId, shift);
    });
  });

  updateOverview();
}

function assignShiftToEmployee(){
  const empSelect = document.getElementById("shiftEmpSelect");
  const typeSelect = document.getElementById("shiftTypeSelect");
  if(!empSelect || !typeSelect) return;

  const empId = empSelect.value;
  const shiftName = typeSelect.value;
  if(!empId || !shiftName) return;

  const emp = employees.find(e => e.id === empId);
  if(!emp) return;

  emp.shifts = emp.shifts || [];
  if(!emp.shifts.includes(shiftName)){
    emp.shifts.push(shiftName);
  }else{
    alert("Nhân viên này đã có ca "+shiftName);
  }

  renderShiftAssignments();
}

function removeShiftFromEmployee(empId, shiftName){
  const emp = employees.find(e => e.id === empId);
  if(!emp) return;
  emp.shifts = emp.shifts.filter(s => s !== shiftName);
  renderShiftAssignments();
}

// ==== REPORTS ====
function renderReportList(){
  const tbody = document.querySelector("#reportTable tbody");
  const deptEl = document.getElementById("reportDept");
  const deptFilter = deptEl?.value || "";

  let data = employees;
  if (deptFilter){
    data = data.filter(e => e.dept === deptFilter);
  }

  if (data.length === 0){
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:14px;">Không có dữ liệu</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(e=>{
    const st = e.stats || {work:0,off:0,late:0};
    return `
      <tr>
        <td>${e.name} (${e.id})</td>
        <td>${e.dept}</td>
        <td>${st.work}</td>
        <td>${st.off}</td>
        <td>${st.late}</td>
      </tr>`;
  }).join("");
}

// ==== REVIEW REQUESTS ====
function renderReviewRequests(){
  const tbody = document.querySelector("#reqTable tbody");
  const filterEl = document.getElementById("reqFilterStatus");
  const filter = filterEl?.value || "";

  let data = reviewRequests;
  if (filter){
    data = data.filter(r => r.status === filter);
  }

  if (data.length === 0){
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:14px;">Không có yêu cầu phù hợp</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.emp}</td>
      <td>${r.date}</td>
      <td>${r.shift}</td>
      <td>${r.type}</td>
      <td>${r.content}</td>
      <td>
        <span class="badge ${r.status}">
          ${r.status==='pending'?'Chờ duyệt': r.status==='approved'?'Đã duyệt':'Từ chối'}
        </span>
      </td>
      <td class="actions">
        ${r.status==='pending'
          ? `<button class="btn sm primary" data-act="approve" data-id="${r.id}">Duyệt</button>
             <button class="btn sm close" data-act="reject" data-id="${r.id}">Từ chối</button>`
          : ''
        }
      </td>
    </tr>
  `).join("");

  // gán sự kiện duyệt / từ chối
  tbody.querySelectorAll("button[data-act='approve']").forEach(btn=>{
    btn.addEventListener("click", ()=> updateRequestStatus(+btn.dataset.id,"approved"));
  });
  tbody.querySelectorAll("button[data-act='reject']").forEach(btn=>{
    btn.addEventListener("click", ()=> updateRequestStatus(+btn.dataset.id,"rejected"));
  });

  updateOverview();
}

function updateRequestStatus(id, status){
  const req = reviewRequests.find(r => r.id === id);
  if(!req) return;
  req.status = status;
  renderReviewRequests();
}
