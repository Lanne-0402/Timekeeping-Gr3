import db from "../config/firebase.js";

async function nextCounter(name) {
  const ref = db.collection("counters").doc(name);

  await db.runTransaction(async (t) => {
    const doc = await t.get(ref);
    const last = doc.exists ? doc.data().last : 0;
    t.set(ref, { last: last + 1 });
  });

  const snap = await ref.get();
  return snap.data().last;
}

export async function generateEmployeeCode() {
  const num = await nextCounter("employees");
  return "NV" + String(num).padStart(3, "0");
}

export async function generateShiftCode() {
  const num = await nextCounter("shifts");
  return "CA" + String(num).padStart(3, "0");
}
