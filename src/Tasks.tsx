import { FormEvent, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { fmt, today, useCollection, useMembers } from "./data";
import { email, useSession } from "./session";

type Repeat = { every: number; unit: "day" | "week" | "month" } | null;
type Task = { title: string; assignee: string; due: string; done: boolean; repeat: Repeat };

const PRESETS: Record<string, { label: string; r: Repeat }> = {
  none: { label: "Bez powtarzania", r: null },
  d1: { label: "Codziennie", r: { every: 1, unit: "day" } },
  w1: { label: "Co tydzień", r: { every: 1, unit: "week" } },
  w2: { label: "Co 2 tygodnie", r: { every: 2, unit: "week" } },
  m1: { label: "Co miesiąc", r: { every: 1, unit: "month" } },
  m3: { label: "Co 3 miesiące", r: { every: 3, unit: "month" } },
  m12: { label: "Co rok", r: { every: 12, unit: "month" } },
};
const repeatLabel = (r: Repeat) =>
  r ? Object.values(PRESETS).find((p) => p.r && p.r.every === r.every && p.r.unit === r.unit)?.label ?? "" : "";

// k-ty termin po dacie bazowej (liczony od bazy, więc 31 stycznia nie dryfuje do 28).
function stepFrom(base: Date, r: NonNullable<Repeat>, k: number) {
  const d = new Date(base);
  if (r.unit === "month") {
    d.setDate(1);
    d.setMonth(base.getMonth() + r.every * k);
    d.setDate(Math.min(base.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else d.setDate(base.getDate() + r.every * k * (r.unit === "week" ? 7 : 1));
  return d;
}
// Następny termin zawsze w przyszłości (też gdy zadanie było mocno spóźnione).
function nextDue(due: string, r: NonNullable<Repeat>) {
  const base = new Date((due || today()) + "T12:00:00");
  let k = 1;
  while (fmt(stepFrom(base, r, k)) <= today()) k++;
  return fmt(stepFrom(base, r, k));
}
function dueInfo(due: string) {
  if (!due) return { text: "", late: false };
  const diff = Math.round((new Date(due + "T12:00:00").getTime() - new Date(today() + "T12:00:00").getTime()) / 86400000);
  const [, m, d] = due.split("-");
  if (diff === 0) return { text: "Dziś", late: false };
  if (diff === 1) return { text: "Jutro", late: false };
  if (diff === -1) return { text: "Wczoraj", late: true };
  return diff < 0 ? { text: `Po terminie: ${d}.${m}`, late: true } : { text: `${d}.${m}`, late: false };
}

export default function Tasks() {
  const s = useSession();
  const tasks = useCollection<Task>("tasks");
  const members = useMembers();
  const [mine, setMine] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [rep, setRep] = useState("none");
  if (s.status !== "member") return null;
  const myId = email(s.user);
  const who = (id: string) => members.find((m) => m.id === id);

  function add(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    // Bez await: offline zapis czeka na sieć, a formularz ma się zamknąć od razu.
    addDoc(collection(db, "tasks"), {
      title: title.trim(), assignee: assignee || myId, due, done: false, repeat: PRESETS[rep].r,
      createdBy: myId, createdAt: serverTimestamp(), notified: false,
    }).catch((err) => console.warn("Zapis zadania:", err.code));
    setTitle(""); setDue(""); setRep("none"); setAssignee(""); setOpen(false);
  }

  function complete(t: Task & { id: string }) {
    const ref = doc(db, "tasks", t.id);
    if (t.repeat) return updateDoc(ref, { due: nextDue(t.due, t.repeat), lastDoneAt: serverTimestamp(), lastDoneBy: myId });
    return updateDoc(ref, { done: true, doneAt: serverTimestamp(), doneBy: myId });
  }
  const remove = (t: Task & { id: string }) =>
    confirm(`Usunąć „${t.title}”?`) && deleteDoc(doc(db, "tasks", t.id));

  const active = tasks.filter((t) => !t.done && (!mine || t.assignee === myId || !t.assignee))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title, "pl"));
  const done = tasks.filter((t) => t.done && (!mine || t.assignee === myId || !t.assignee));

  return (
    <>
      <div className="chips" role="group" aria-label="Filtr zadań">
        <button aria-pressed={mine} onClick={() => setMine(true)}>Moje</button>
        <button aria-pressed={!mine} onClick={() => setMine(false)}>Wszystkie</button>
      </div>

      {open ? (
        <form onSubmit={add} className="form card">
          <input autoFocus placeholder="Co trzeba zrobić?" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={assignee || myId} onChange={(e) => setAssignee(e.target.value)}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Termin" />
          <select value={rep} onChange={(e) => setRep(e.target.value)} aria-label="Powtarzanie">
            {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
          <button className="btn primary">Dodaj zadanie</button>
          <button type="button" className="btn" onClick={() => setOpen(false)}>Anuluj</button>
        </form>
      ) : (
        <button className="btn primary wide" onClick={() => setOpen(true)}>Nowe zadanie</button>
      )}

      {active.length === 0 && <p className="empty">Brak zadań. Dodaj pierwsze.</p>}
      <ul className="list">
        {active.map((t) => {
          const di = dueInfo(t.due), p = who(t.assignee), rl = repeatLabel(t.repeat);
          return (
            <li key={t.id}>
              <button className="row" role="checkbox" aria-checked={false} onClick={() => complete(t)}>
                <span className="check" aria-hidden />
                <span className="grow">
                  {t.title}
                  <small className={di.late ? "late" : ""}>
                    {[di.text, rl, !mine && p ? p.name : ""].filter(Boolean).join(", ")}
                  </small>
                </span>
              </button>
              {p && <span className="dot" style={{ background: p.color }} title={p.name} />}
              <button className="btn small" aria-label={`Usuń ${t.title}`} onClick={() => remove(t)}>×</button>
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <details>
          <summary>Zrobione ({done.length})</summary>
          <ul className="list">
            {done.map((t) => (
              <li key={t.id}>
                <button className="row" role="checkbox" aria-checked onClick={() => updateDoc(doc(db, "tasks", t.id), { done: false })}>
                  <span className="check on" aria-hidden>✓</span>
                  <span className="grow struck">{t.title}</span>
                </button>
                <button className="btn small" aria-label={`Usuń ${t.title}`} onClick={() => remove(t)}>×</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
