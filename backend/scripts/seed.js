import db from "../config/firebase.js";
import bcrypt from "bcryptjs";
import { Timestamp } from "firebase-admin/firestore";
import { generateEmployeeCode, generateShiftCode } from "../utils/idGenerator.js";

/* ==========================================
   CONFIG
========================================== */

const NUM_EMPLOYEES = 10;
const NUM_SHIFTS_NOV = 30;
const NUM_SHIFTS_DEC = 20;

/* ==========================================
   HELPERS
========================================== */

function formatDate(d) {
  return d.toISOString().split("T")[0];
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function randomTime() {
  const arr = [
    ["07:00", "11:00"],
    ["08:00", "17:00"],
    ["10:30", "17:30"],
    ["13:00", "17:00"],
    ["17:00", "22:00"],
  ];
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ==========================================
   1) SEED USERS
========================================== */

async function seedUsers() {
  console.log("Seeding users...");

  const users = [];

  for (let i = 1; i <= NUM_EMPLOYEES; i++) {
    const empCode = await generateEmployeeCode();
    const hash = await bcrypt.hash("12345678", 10);

    const ref = db.collection("users").doc();

    const u = {
      id: ref.id,
      employeeCode: empCode,
      name: `Nhân viên ${i}`,
      email: `nv${i}@example.com`,
      passwordHash: hash,
      role: "user",
      position: "employee",
      dept: "",
      status: "active",
      workStatus: "dang_lam",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await ref.set(u);
    users.push(u);
  }

  console.log("✓ Users seeded");
  return users;
}

/* ==========================================
   2) SEED SHIFTS (NOV + DEC)
========================================== */

async function seedShifts() {
  console.log("Seeding shifts...");

  const shifts = [];

  // THÁNG 11
  let dNov = new Date("2025-11-01");
  for (let i = 0; i < NUM_SHIFTS_NOV; i++) {
    const d = addDays(dNov, i);
    const date = formatDate(d);
    const code = await generateShiftCode();
    const [start, end] = randomTime();

    const ref = db.collection("shifts").doc();

    const shift = {
      id: ref.id,
      shiftCode: code,
      name: `Ca ngày ${date}`,
      date,
      startTime: start,
      endTime: end,
      createdAt: Timestamp.now(),
    };

    await ref.set(shift);
    shifts.push(shift);
  }

  // THÁNG 12
  let dDec = new Date("2025-12-01");
  for (let i = 0; i < NUM_SHIFTS_DEC; i++) {
    const d = addDays(dDec, i);
    const date = formatDate(d);
    const code = await generateShiftCode();
    const [start, end] = randomTime();

    const ref = db.collection("shifts").doc();

    const shift = {
      id: ref.id,
      shiftCode: code,
      name: `Ca ngày ${date}`,
      date,
      startTime: start,
      endTime: end,
      createdAt: Timestamp.now(),
    };

    await ref.set(shift);
    shifts.push(shift);
  }

  console.log("✓ Shifts seeded");
  return shifts;
}

/* ==========================================
   3) ASSIGN SHIFTS TO USERS
========================================== */

async function seedAssignments(users, shifts) {
  console.log("Seeding assignments...");

  for (const u of users) {
    const amount = Math.floor(Math.random() * 4) + 3; // 3–6 ca

    for (let i = 0; i < amount; i++) {
      const s = shifts[Math.floor(Math.random() * shifts.length)];

      await db.collection("user_shifts").add({
        userId: u.id,
        shiftId: s.id,
        date: s.date,
        assignedAt: Timestamp.now(),
      });

    }
  }

  console.log("✓ Assignments seeded");
}

/* ==========================================
   4) SEED ATTENDANCE
========================================== */

async function seedAttendance(users, shifts) {
  console.log("Seeding attendance...");

  for (const u of users) {
    const targetShifts = shifts.slice(0, 15);

    for (const s of targetShifts) {
      const r = Math.random();

      let checkIn = null;
      let checkOut = null;

      if (r < 0.60) {
        checkIn = s.startTime;
        checkOut = s.endTime;
      }

      else if (r < 0.80) {
        const [h, m] = s.startTime.split(":");
        const late = Math.floor(Math.random() * 21) + 10;
        const newMin = parseInt(m) + late;
        const finalMin = newMin >= 60 ? "50" : newMin.toString().padStart(2, "0");
        checkIn = `${h}:${finalMin}`;
        checkOut = s.endTime;
      }

      else if (r < 0.90) {
        checkIn = s.startTime;
        const [h, m] = s.endTime.split(":");
        const early = Math.floor(Math.random() * 16) + 15;
        const newMin = parseInt(m) - early;
        const finalMin = newMin < 0 ? "00" : newMin.toString().padStart(2, "0");
        checkOut = `${h}:${finalMin}`;
      }

      else {
        checkIn = null;
        checkOut = null;
      }

      await db.collection("attendance").add({
        userId: u.id,
        shiftId: s.id,
        date: s.date,
        checkIn,
        checkOut,
        createdAt: Timestamp.now(),
      });
    }
  }

  console.log("✓ Attendance seeded");
}

/* ==========================================
   MAIN RUN
========================================== */

async function run() {
  console.log("======= START SEEDING =======");

  const users = await seedUsers();
  const shifts = await seedShifts();
  await seedAssignments(users, shifts);
  await seedAttendance(users, shifts);

  console.log("======= DONE SEEDING =======");
  process.exit(0);
}

run();
