/**
 * BACKFILL FULL V3
 * - Bổ sung employeeCode cho users
 * - Bổ sung shiftCode cho shifts
 * - Bổ sung employeeCode + shiftName/start/end cho user_shifts
 * - Bổ sung employeeCode + shiftName/start/end cho attendance
 * 
 * SAFE – không overwrite dữ liệu đã tồn tại
 */

import db from "../config/firebase.js";

function pad(num) {
  return String(num).padStart(3, "0");
}

// -------------------------------------------------------------
// 1. USERS – Bổ sung employeeCode
// -------------------------------------------------------------
async function backfillUsers() {
  console.log("\n=== Backfilling employeeCode for users ===");

  const snap = await db.collection("users").get();

  let index = 1;
  let updates = [];

  for (const doc of snap.docs) {
    const u = doc.data();

    if (u.role === "admin" || u.role === "System Admin") continue;
    if (u.employeeCode) continue;

    const code = `NV${pad(index++)}`;
    updates.push({ id: doc.id, employeeCode: code });
  }

  for (const u of updates) {
    await db.collection("users").doc(u.id).update({
      employeeCode: u.employeeCode,
    });
  }

  console.table(updates);
  console.log(`→ Done. ${updates.length} users updated.`);
}

// -------------------------------------------------------------
// 2. SHIFTS – Bổ sung shiftCode
// -------------------------------------------------------------
async function backfillShifts() {
  console.log("\n=== Backfilling shiftCode for shifts ===");

  const snap = await db.collection("shifts").get();

  let index = 1;
  let updates = [];

  for (const doc of snap.docs) {
    const s = doc.data();
    if (s.shiftCode) continue;

    const code = `CA${pad(index++)}`;
    updates.push({ id: doc.id, shiftCode: code });
  }

  for (const s of updates) {
    await db.collection("shifts").doc(s.id).update({
      shiftCode: s.shiftCode
    });
  }

  console.table(updates);
  console.log(`→ Done. ${updates.length} shifts updated.`);
}

// -------------------------------------------------------------
// Helper: Tạo map userId → employeeCode
// -------------------------------------------------------------
async function loadUserMap() {
  const snap = await db.collection("users").get();
  const map = {};

  snap.forEach(doc => {
    const u = doc.data();
    map[doc.id] = {
      employeeCode: u.employeeCode || null,
      name: u.name || ""
    };
  });

  return map;
}

// -------------------------------------------------------------
// Helper: Tạo map shiftId → shift info
// -------------------------------------------------------------
async function loadShiftMap() {
  const snap = await db.collection("shifts").get();
  const map = {};

  snap.forEach(doc => {
    const s = doc.data();
    map[doc.id] = {
      shiftCode: s.shiftCode || null,
      shiftName: s.name || null,
      shiftStart: s.startTime || null,
      shiftEnd: s.endTime || null,
      date: s.date || null,
    };
  });

  return map;
}

// -------------------------------------------------------------
// 3. USER_SHIFTS – Bổ sung employeeCode + shiftName/start/end
// -------------------------------------------------------------
async function backfillUserShifts(userMap, shiftMap) {
  console.log("\n=== Backfilling user_shifts ===");

  const snap = await db.collection("user_shifts").get();

  let updates = [];

  for (const doc of snap.docs) {
    const r = doc.data();
    let updated = {};

    // add employeeCode
    if (!r.employeeCode && userMap[r.userId]?.employeeCode) {
      updated.employeeCode = userMap[r.userId].employeeCode;
    }

    // add shift info
    const s = shiftMap[r.shiftId];
    if (s) {
      if (!r.shiftName && s.shiftName) updated.shiftName = s.shiftName;
      if (!r.shiftStart && s.shiftStart) updated.shiftStart = s.shiftStart;
      if (!r.shiftEnd && s.shiftEnd) updated.shiftEnd = s.shiftEnd;
      // ensure date sync (optional)
      if (!r.date && s.date) updated.date = s.date;
    }

    if (Object.keys(updated).length > 0) {
      updates.push({ id: doc.id, ...updated });
      await db.collection("user_shifts").doc(doc.id).update(updated);
    }
  }

  console.table(updates);
  console.log(`→ Done. ${updates.length} user_shifts updated.`);
}

// -------------------------------------------------------------
// 4. ATTENDANCE – Bổ sung employeeCode + shiftName/start/end
// -------------------------------------------------------------
async function backfillAttendance(userMap, shiftMap) {
  console.log("\n=== Backfilling attendance ===");

  const snap = await db.collection("attendance").get();

  let updates = [];

  for (const doc of snap.docs) {
    const r = doc.data();
    let updated = {};

    // add employeeCode
    if (!r.employeeCode && userMap[r.userId]?.employeeCode) {
      updated.employeeCode = userMap[r.userId].employeeCode;
    }

    // add shift info
    const s = shiftMap[r.shiftId];
    if (s) {
      if (!r.shiftName && s.shiftName) updated.shiftName = s.shiftName;
      if (!r.shiftStart && s.shiftStart) updated.shiftStart = s.shiftStart;
      if (!r.shiftEnd && s.shiftEnd) updated.shiftEnd = s.shiftEnd;
    }

    if (Object.keys(updated).length > 0) {
      updates.push({ id: doc.id, ...updated });
      await db.collection("attendance").doc(doc.id).update(updated);
    }
  }

  console.table(updates);
  console.log(`→ Done. ${updates.length} attendance rows updated.`);
}

// -------------------------------------------------------------
// MAIN
// -------------------------------------------------------------
async function main() {
  console.log("\n==========================================");
  console.log("         RUNNING FULL BACKFILL V3");
  console.log("==========================================\n");

  // Step 1: base codes
  await backfillUsers();
  await backfillShifts();

  // Load updated reference maps
  const userMap = await loadUserMap();
  const shiftMap = await loadShiftMap();

  // Step 2: backfill relational tables
  await backfillUserShifts(userMap, shiftMap);
  await backfillAttendance(userMap, shiftMap);

  console.log("\n🎉 FULL BACKFILL HOÀN TẤT!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ ERROR:", err);
  process.exit(1);
});
