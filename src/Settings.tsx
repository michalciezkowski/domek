import { FormEvent, useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { email, logout, Member, useSession } from "./session";
import { disablePush, enablePush, pushEnabledHere, pushSupported, setPref, usePrefs } from "./push";

const PALETTE = ["#0f766e", "#c2410c", "#4338ca", "#be185d", "#4d7c0f", "#a16207", "#0369a1"];

export default function Settings() {
  const s = useSession();
  const [members, setMembers] = useState<(Member & { id: string })[]>([]);
  const [mail, setMail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(
    () => onSnapshot(collection(db, "members"), (q) =>
      setMembers(q.docs.map((d) => ({ id: d.id, ...(d.data() as Member) })))),
    []
  );
  if (s.status !== "member") return null;
  const myId = email(s.user);

  async function add(e: FormEvent) {
    e.preventDefault();
    setErr("");
    const id = mail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(id)) return setErr("Wpisz poprawny adres e-mail.");
    if (members.some((m) => m.id === id)) return setErr("Ten adres jest już na liście.");
    try {
      await setDoc(doc(db, "members", id), {
        name: name.trim() || id.split("@")[0],
        color: PALETTE[members.length % PALETTE.length],
        createdAt: serverTimestamp(),
      });
      setMail(""); setName("");
    } catch { setErr("Nie udało się dodać. Sprawdź połączenie i spróbuj ponownie."); }
  }

  return (
    <>
      <section>
        <h2>Domownicy</h2>
        <ul className="list">
          {members.map((m) => (
            <li key={m.id}>
              <span className="dot" style={{ background: m.color }} />
              <span className="grow"><b>{m.name}</b><small>{m.id}</small></span>
              {m.id !== myId && (
                <button className="btn small" onClick={() => confirm(`Usunąć ${m.name}?`) && deleteDoc(doc(db, "members", m.id))}>
                  Usuń
                </button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={add} className="form">
          <input placeholder="Imię" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Adres Gmail" type="email" value={mail} onChange={(e) => setMail(e.target.value)} required />
          <button className="btn primary">Dodaj domownika</button>
          {err && <p className="err" role="alert">{err}</p>}
        </form>
      </section>
      <Push />
      <section>
        <h2>Konto</h2>
        <button className="btn" onClick={logout}>Wyloguj się</button>
      </section>
    </>
  );
}

function Push() {
  const s = useSession();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(pushEnabledHere());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const prefs = usePrefs(s.status === "member" ? s.user : null);
  useEffect(() => { pushSupported().then(setSupported); }, []);
  if (s.status !== "member") return null;
  const user = s.user;
  const blocked = "Notification" in window && Notification.permission === "denied";

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr("");
    try { await fn(); }
    catch (e) {
      const m = e instanceof Error ? e.message : "";
      setErr(m === "denied" ? "Zgoda nie została udzielona. Zezwól na powiadomienia dla tej strony w ustawieniach przeglądarki." : m || "Nie udało się zmienić ustawienia.");
    }
    setBusy(false);
  }

  return (
    <section>
      <h2>Powiadomienia</h2>
      {supported === null ? null : !supported ? (
        <p className="empty">Ta przeglądarka nie obsługuje powiadomień push.</p>
      ) : blocked ? (
        <p className="empty">Powiadomienia są zablokowane dla tej strony. Odblokuj je w ustawieniach przeglądarki (ikona kłódki przy adresie).</p>
      ) : !on ? (
        <>
          <p>Dostaniesz powiadomienie o nowych produktach na liście, zadaniach przypisanych do Ciebie i terminach. Działa na każdym telefonie osobno.</p>
          <button className="btn primary" disabled={busy}
            onClick={() => run(async () => { await enablePush(user); setOn(true); })}>
            Włącz na tym telefonie
          </button>
        </>
      ) : (
        <>
          <label className="toggle">
            <input type="checkbox" checked={prefs.shopping} onChange={(e) => setPref(user, "shopping", e.target.checked)} />
            Nowe pozycje na liście zakupów
          </label>
          <label className="toggle">
            <input type="checkbox" checked={prefs.tasks} onChange={(e) => setPref(user, "tasks", e.target.checked)} />
            Zadania dla mnie i terminy
          </label>
          <button className="btn" disabled={busy}
            onClick={() => run(async () => { await disablePush(user); setOn(false); })}>
            Wyłącz na tym telefonie
          </button>
        </>
      )}
      {err && <p className="err" role="alert">{err}</p>}
    </section>
  );
}
