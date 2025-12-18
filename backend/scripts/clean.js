import db from "../config/firebase.js";

async function fixDuplicateShifts() {
  const snap = await db.collection("user_shifts").get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const map = {};

  all.forEach((r) => {
    const key = `${r.userId}_${r.date}`;
    if (!map[key]) map[key] = [];
    map[key].push(r);
  });

  for (const key in map) {
    const list = map[key];
    if (list.length > 1) {
      console.log("Duplicate detected:", key, list.length);

      // Giữ lại 1 record → xoá record thừa
      for (let i = 1; i < list.length; i++) {
        await db.collection("user_shifts").doc(list[i].id).delete();
        console.log("Deleted:", list[i].id);
      }
    }
  }

  console.log("Done cleaning duplicates!");
}

fixDuplicateShifts();
