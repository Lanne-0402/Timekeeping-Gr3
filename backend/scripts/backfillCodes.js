// backend/scripts/backfillCodes.js
import db from "../config/firebase.js";
import { generateEmployeeCode, generateShiftCode } from "../utils/idGenerator.js";

// Role KHÔNG đổi ID
const ADMIN_ROLES = ["admin", "System Admin", "manager"];

async function backfillEmployees() {
  const snap = await db.collection("users").get();

  for (const doc of snap.docs) {
    const data = doc.data();

    // Bỏ admin / manager
    if (ADMIN_ROLES.includes(data.role)) {
      console.log(`Skip admin/manager: ${data.email}`);
      continue;
    }

    // Nếu đã có employeeCode → bỏ qua
    if (data.employeeCode) {
      console.log(`Skip existing code: ${data.email} (${data.employeeCode})`);
      continue;
    }

    // Tạo mã NVxxx
    const code = await generateEmployeeCode();
    await doc.ref.update({ employeeCode: code });

    console.log(`User ${data.email} → ${code}`);
  }
}

async function backfillShifts() {
  const snap = await db.collection("shifts").get();

  for (const doc of snap.docs) {
    const data = doc.data();

    // Nếu đã có mã → bỏ qua
    if (data.shiftCode) {
      console.log(`Skip existing shift: ${data.name}`);
      continue;
    }

    const code = await generateShiftCode();
    await doc.ref.update({ shiftCode: code });

    console.log(`Shift ${data.name} → ${code}`);
  }
}

async function run() {
  try {
    console.log("== Backfilling employees ==");
    await backfillEmployees();

    console.log("== Backfilling shifts ==");
    await backfillShifts();

    console.log("DONE ✔✔✔");
    process.exit(0);
  } catch (err) {
    console.error("Backfill ERROR:", err);
    process.exit(1);
  }
}

run();
