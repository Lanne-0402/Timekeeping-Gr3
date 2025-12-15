import db from "../config/firebase.js";

export const generateEmployeeCode = async () => {
  const ref = db.collection("counters").doc("employees");

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    let current = 0;
    if (snap.exists) {
      current = snap.data().value || 0;
    }

    const next = current + 1;
    tx.set(ref, { value: next }, { merge: true });

    return next;
  });

  return `NV${String(result).padStart(3, "0")}`;
};

export const generateShiftCode = async () => {
  const ref = db.collection("counters").doc("shifts");

  const next = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data().value || 0 : 0;
    const value = current + 1;

    tx.set(ref, { value }, { merge: true });
    return value;
  });

  return `CA${String(next).padStart(3, "0")}`;
};

