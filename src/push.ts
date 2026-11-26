import { User } from "firebase/auth";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { arrayRemove, arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { app, db } from "./firebase";
import { email } from "./session";

// devices/{email}: { tokens: string[], prefs: { shopping?: boolean, tasks?: boolean } }
// Cron (scripts/reminders.mjs) czyta ten dokument i wysyła push na wszystkie tokeny osoby.
export type Prefs = { shopping: boolean; tasks: boolean };
const FLAG = "domek-push";        // czy ten telefon ma włączone powiadomienia
const TOKEN = "domek-push-token"; // ostatni token zapisany z tego telefonu
const ref = (u: User) => doc(db, "devices", email(u));

export const pushSupported = async () =>
  "Notification" in window && "serviceWorker" in navigator && (await isSupported().catch(() => false));
export const pushEnabledHere = () =>
  "Notification" in window && Notification.permission === "granted" && localStorage.getItem(FLAG) === "1";

async function deviceToken() {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("Brak VITE_FIREBASE_VAPID_KEY w pliku .env (patrz README-etap3).");
  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Nie udało się uzyskać tokenu powiadomień.");
  return token;
}

export async function enablePush(u: User) {
  // Prośba o zgodę musi wyjść z kliknięcia (Android).
  if ((await Notification.requestPermission()) !== "granted") throw new Error("denied");
  const token = await deviceToken();
  await setDoc(ref(u), { tokens: arrayUnion(token), updatedAt: serverTimestamp() }, { merge: true });
  localStorage.setItem(FLAG, "1");
  localStorage.setItem(TOKEN, token);
}

export async function disablePush(u: User) {
  const token = localStorage.getItem(TOKEN);
  localStorage.removeItem(FLAG);
  localStorage.removeItem(TOKEN);
  if (token) await setDoc(ref(u), { tokens: arrayRemove(token) }, { merge: true });
  await deleteToken(getMessaging(app)).catch(() => false);
}

// Przy starcie apki: jeśli token się zmienił, zapisz nowy (stare czyści cron po błędzie FCM).
export async function syncPush(u: User) {
  if (!pushEnabledHere() || !(await pushSupported())) return;
  const token = await deviceToken();
  if (token === localStorage.getItem(TOKEN)) return;
  await setDoc(ref(u), { tokens: arrayUnion(token), updatedAt: serverTimestamp() }, { merge: true });
  localStorage.setItem(TOKEN, token);
}

export const setPref = (u: User, key: keyof Prefs, value: boolean) =>
  setDoc(ref(u), { prefs: { [key]: value } }, { merge: true });

export function usePrefs(u: User | null): Prefs {
  const [prefs, setPrefs] = useState<Prefs>({ shopping: true, tasks: true });
  const uid = u?.uid;
  useEffect(() => {
    if (!u) return;
    return onSnapshot(
      ref(u),
      (d) => setPrefs({ shopping: d.data()?.prefs?.shopping !== false, tasks: d.data()?.prefs?.tasks !== false }),
      (e) => console.warn("Firestore: devices", e.code)
    );
  }, [uid]);
  return prefs;
}
