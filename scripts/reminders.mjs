// Uruchamiany z GitHub Actions co ~10 min (.github/workflows/reminders.yml).
// MODE=run (domyślnie) | test (wyślij testowe powiadomienie na wszystkie zarejestrowane telefony)
import { cert, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { DAY, hasWork, plan, quiet, warsawNow } from "./lib.mjs";

const mode = process.env.MODE || "run";
const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.error("Brak sekretu FIREBASE_SERVICE_ACCOUNT."); process.exit(1); }
let account;
try { account = JSON.parse(raw); } catch { console.error("FIREBASE_SERVICE_ACCOUNT nie jest poprawnym JSON-em."); process.exit(1); }

const now = warsawNow();
if (mode === "run" && quiet(now.hour)) { console.log("Cisza nocna – koniec."); process.exit(0); }

initializeApp({ credential: cert(account) });
const db = getFirestore();
const fcm = getMessaging();

async function loadDevices() {
  const out = {};
  (await db.collection("devices").get()).forEach((d) => {
    const v = d.data();
    out[d.id] = { tokens: v.tokens ?? [], prefs: v.prefs ?? {} };
  });
  return out;
}

async function deliver(messages, devices) {
  const dead = [];
  let sent = 0;
  for (const m of messages) {
    const tokens = devices[m.to]?.tokens ?? [];
    if (!tokens.length) continue;
    const data = { title: m.title, body: m.body, tag: m.tag };
    if (m.tab) data.tab = m.tab;
    const res = await fcm.sendEachForMulticast({ tokens, data, webpush: { headers: { Urgency: "high", TTL: "86400" } } });
    sent += res.successCount;
    res.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") dead.push([m.to, tokens[i]]);
      else console.warn("FCM błąd:", code);
    });
  }
  for (const [to, token] of dead) {
    await db.collection("devices").doc(to).update({ tokens: FieldValue.arrayRemove(token) }).catch(() => {});
  }
  console.log(`Wysłano: ${sent}, usunięto martwych tokenów: ${dead.length}`);
}

if (mode === "test") {
  const devices = await loadDevices();
  const messages = Object.keys(devices).map((to) => ({ to, title: "Domek", body: "Test powiadomień działa.", tag: "test", tab: "" }));
  await deliver(messages, devices);
  process.exit(0);
}

// Odczyty są filtrowane, żeby zmieścić się w darmowym limicie Spark (50 tys. odczytów/dzień).
const [shopSnap, taskSnap] = await Promise.all([
  db.collection("shopping").where("notified", "==", false).get(),
  db.collection("tasks").where("done", "==", false).get(),
]);
const shopping = shopSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
const tasks = taskSnap.docs.map((d) => {
  const v = d.data();
  return { id: d.id, ...v, createdMs: v.createdAt?.toMillis?.() ?? 0 };
});

if (hasWork(shopping, tasks, now.date)) {
  const devices = await loadDevices();
  const names = {};
  (await db.collection("members").get()).forEach((d) => { names[d.id] = d.data().name; });
  const { messages, shoppingIds, taskPatches } = plan({ shopping, tasks, devices, names, today: now.date, nowMs: Date.now() });
  await deliver(messages, devices);
  const writes = [
    ...shoppingIds.map((id) => db.collection("shopping").doc(id).update({ notified: true })),
    ...taskPatches.map(({ id, patch }) => db.collection("tasks").doc(id).update(patch)),
  ];
  // update (nie set): usunięty w międzyczasie dokument nie może się odtworzyć.
  await Promise.allSettled(writes);
  console.log(`Zakupy: ${shoppingIds.length}, zadania: ${taskPatches.length}, wiadomości: ${messages.length}`);
} else {
  console.log("Nic do wysłania.");
}

// Porządki raz dziennie (o 7:xx): zrobione zadania starsze niż 30 dni.
if (now.hour === 7) {
  const old = await db.collection("tasks").where("done", "==", true).get();
  const cutoff = Date.now() - 30 * DAY;
  const stale = old.docs.filter((d) => (d.data().doneAt?.toMillis?.() ?? Infinity) < cutoff);
  await Promise.allSettled(stale.map((d) => d.ref.delete()));
  console.log(`Usunięto starych zadań: ${stale.length}`);
}
