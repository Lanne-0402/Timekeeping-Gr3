import db from "../config/firebase.js";
import bcrypt from "bcryptjs";
import { Timestamp } from "firebase-admin/firestore";

/* =====================================================
   CONFIG
===================================================== */

const EMPLOYEES = [
  { name: "Nguyễn Văn A", email: "a@example.com", dept: "Bán hàng" },
  { name: "Trần Thị B", email: "b@example.com", dept: "Kho" },
  { name: "Lê Văn C", email: "c@example.com", dept: "Bảo vệ" },
  { name: "Phạm Thị D", email: "d@example.com", dept: "Kế toán" },
  { name: "Hoàng Văn E", email: "e@example.com", dept: "Bán hàng" },
  { name: "Võ Thị F", email: "f@example.com", dept: "Kho" },
  { name: "Đinh Văn G", email: "g@example.com", dept: "Marketing" },
];

const MONTHS = [
  { start: "2025-11-01", end: "2025-11-30" },
  { start: "2025-12-01", end: "2025-12-31" },
];

/* =====================================================
   HELPERS
===================================================== */

function formatDate(d) {
  return d.toISOString().split("T")[0];
}

function randomLate(start) {
  const [h, m] = start.split(":");
  const late = Math.floor(Math.random() * 16) + 5; // 5–20 phút
  const newMin = parseInt(m) + late;
  return `${h}:${String(newMin % 60).padStart(2, "0")}`;
}

function randomEarly(end) {
  const [h, m] = end.split(":");
  const early = Math.floor(Math.random() * 11) + 10; // 10–20 phút về sớm
  const newMin = parseInt(m) - early;
  return `${h}:${newMin < 0 ? "00" : String(newMin).padStart(2, "0")}`;
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* =====================================================
   0) DELETE OLD DATA (safe)
===================================================== */

async function deleteCollection(col, keepFilter = null) {
  const snap = await db.collection(col).get();

  const batch = db.batch();
  snap.docs.forEach(doc => {
    const data = doc.data();

    if (keepFilter && keepFilter(data)) return; // skip items we keep

    batch.delete(doc.ref);
  });

  await batch.commit();
}

async function wipeOldData() {
  console.log("🧹 Deleting old data…");

  // Xoá users trừ admin
  await deleteCollection("users", (u) => u.role === "admin");

  // Xoá shifts, user_shifts, attendance
  await deleteCollection("shifts");
  await deleteCollection("user_shifts");
  await deleteCollection("attendance");

  console.log("✓ Old data wiped");
}

/* =====================================================
   1) Seed Users
===================================================== */

async function seedUsers() {
  console.log("👤 Seeding users…");

  const passwordHash = await bcrypt.hash("12345678", 10);
  const users = [];

  for (let i = 0; i < EMPLOYEES.length; i++) {
    const ref = db.collection("users").doc();

    const u = {
      id: ref.id,
      name: EMPLOYEES[i].name,
      email: EMPLOYEES[i].email,
      dept: EMPLOYEES[i].dept,
      role: "user",
      status: "active",
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await ref.set(u);
    users.push(u);
  }

  console.log("✓ Users seeded");
  return users;
}

/* =====================================================
   2) Seed Shifts (Nov + Dec)
===================================================== */

async function seedShifts() {
  console.log("📅 Seeding shifts…");

  const shifts = [];
  const times = [
    ["08:00", "17:00"],
    ["09:00", "18:00"],
  ];

  for (const m of MONTHS) {
    let d = new Date(m.start);
    const end = new Date(m.end);

    while (d <= end) {
      const day = d.getDay(); // 0 CN, 6 T7

      if (day !== 0 && day !== 6) {
        const date = formatDate(d);
        const num = Math.random() < 0.7 ? 1 : 2;

        for (let i = 0; i < num; i++) {
          const [start, end] = rand(times);
          const ref = db.collection("shifts").doc();

          const s = {
            id: ref.id,
            shiftCode: "CA" + Math.floor(Math.random() * 900 + 100),
            name: `Ca ${i + 1} – ${date}`,
            date,
            startTime: start,
            endTime: end,
            createdAt: Timestamp.now(),
          };

          await ref.set(s);
          shifts.push(s);
        }
      }

      d.setDate(d.getDate() + 1);
    }
  }

  console.log("✓ Shifts seeded");
  return shifts;
}

/* =====================================================
   3) Assign users to shifts
===================================================== */

async function seedAssignments(users, shifts) {
  console.log("🧩 Seeding assignments…");

  const assignments = [];

  for (const s of shifts) {
    const numEmployees = Math.floor(Math.random() * 4) + 1;

    const chosen = users
      .sort(() => 0.5 - Math.random())
      .slice(0, numEmployees);

    for (const u of chosen) {
      const ref = db.collection("user_shifts").doc();
      const a = {
        id: ref.id,
        userId: u.id,
        shiftId: s.id,
        date: s.date,
        assignedAt: Timestamp.now(),
      };

      await ref.set(a);
      assignments.push({ ...a, shift: s, user: u });
    }
  }

  console.log("✓ Assignments seeded");
  return assignments;
}

/* =====================================================
   4) Seed Attendance
===================================================== */

async function seedAttendance(assignments) {
  console.log("🕒 Seeding attendance…");

  for (const a of assignments) {
    const r = Math.random();

    let checkInAt = null;
    let checkOutAt = null;

    if (r < 0.6) {
      checkInAt = `${a.date}T${a.shift.startTime}:00`;
      checkOutAt = `${a.date}T${a.shift.endTime}:00`;
    } else if (r < 0.8) {
      checkInAt = `${a.date}T${randomLate(a.shift.startTime)}:00`;
      checkOutAt = `${a.date}T${a.shift.endTime}:00`;
    } else if (r < 0.9) {
      checkInAt = `${a.date}T${a.shift.startTime}:00`;
      checkOutAt = `${a.date}T${randomEarly(a.shift.endTime)}:00`;
    } else {
      checkInAt = null;
      checkOutAt = null;
    }

    await db.collection("attendance").add({
      userId: a.userId,
      shiftId: a.shiftId,
      date: a.date,
      checkInAt,
      checkOutAt,
      workSeconds:
        checkInAt && checkOutAt
          ? (new Date(checkOutAt) - new Date(checkInAt)) / 1000
          : 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  console.log("✓ Attendance seeded");
}

/* =====================================================
   MAIN
===================================================== */

async function run() {
  console.log("=== START SEEDING ===");

  await wipeOldData();

  const users = await seedUsers();
  const shifts = await seedShifts();
  const assignments = await seedAssignments(users, shifts);
  await seedAttendance(assignments);

  console.log("=== DONE SEEDING ===");
  process.exit(0);
}

run();
