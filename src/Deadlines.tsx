import { FormEvent, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { today, useCollection, useMembers } from "./data";
import { email, useSession } from "./session";
import { canDeleteTask } from "./taskRules";
import { addYearsYmd, deadlineBadge } from "./deadlineUtils";

export type Deadline = {
  title: string;
  due: string;
  owner: string;
  note: string;
  createdBy?: string;
};

export default function Deadlines() {
  const s = useSession();
  const items = useCollection<Deadline>("deadlines");
  const members = useMembers();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");
  const [note, setNote] = useState("");

  if (s.status !== "member") return null;
  const myId = email(s.user);
  const todayYmd = today();
  const who = (id: string) => members.find((m) => m.id === id);

  function resetForm() {
    setTitle("");
    setDue("");
    setOwner("");
    setNote("");
    setEditId(null);
    setOpen(false);
  }

  function startEdit(d: Deadline & { id: string }) {
    setEditId(d.id);
    setTitle(d.title);
    setDue(d.due);
    setOwner(d.owner || "");
    setNote(d.note || "");
    setOpen(true);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !due) return;
    const payload = {
      title: title.trim(),
      due,
      owner,
      note: note.trim(),
      updatedAt: serverTimestamp(),
    };
    if (editId) {
      updateDoc(doc(db, "deadlines", editId), payload)
        .catch((err) => console.warn("Edycja terminu:", err.code));
    } else {
      addDoc(collection(db, "deadlines"), {
        ...payload,
        createdBy: myId,
        createdAt: serverTimestamp(),
      }).catch((err) => console.warn("Zapis terminu:", err.code));
    }
    resetForm();
  }

  function extendYear(d: Deadline & { id: string }) {
    const next = addYearsYmd(d.due, 1);
    const [y, m, day] = next.split("-");
    if (!confirm(`Przedłużyć „${d.title}” o rok (do ${day}.${m}.${y})?`)) return;
    updateDoc(doc(db, "deadlines", d.id), { due: next, updatedAt: serverTimestamp() })
      .catch((err) => console.warn("Przedłużenie terminu:", err.code));
  }

  function remove(d: Deadline & { id: string }) {
    if (!canDeleteTask(d, myId) || !confirm(`Usunąć termin „${d.title}”?`)) return;
    deleteDoc(doc(db, "deadlines", d.id));
  }

  const sorted = [...items].sort(
    (a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "pl")
  );

  return (
    <>
      {open ? (
        <form onSubmit={save} className="form card">
          <input
            autoFocus
            placeholder="Nazwa (np. Przegląd auta, Polisa OC, Paszport)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Data ważności"
            required
          />
          <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Kogo dotyczy">
            <option value="">Cały dom (wspólne)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <input
            placeholder="Notatka (opcjonalnie, np. nr polisy / rejestracyjny)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="btn primary">{editId ? "Zapisz zmiany" : "Dodaj termin"}</button>
          <button type="button" className="btn" onClick={resetForm}>Anuluj</button>
        </form>
      ) : (
        <button className="btn primary wide" onClick={() => setOpen(true)}>Nowy termin</button>
      )}

      {sorted.length === 0 ? (
        <p className="empty">Brak zapisanych terminów (przeglądy, ubezpieczenia, dokumenty, umowy).</p>
      ) : (
        <ul className="list">
          {sorted.map((d) => {
            const b = deadlineBadge(d.due, todayYmd);
            const p = d.owner ? who(d.owner) : undefined;
            const canDel = canDeleteTask(d, myId);
            return (
              <li key={d.id} className="dl-item">
                {p && <span className="dot" style={{ background: p.color }} title={p.name} />}
                <div className="grow">
                  <div className="dl-title">{d.title}</div>
                  <small className={b.urgent ? "late" : ""}>
                    {[b.label, p ? p.name : ""].filter(Boolean).join(" · ")}
                  </small>
                  {d.note && <small className="dl-note">{d.note}</small>}
                </div>
                <div className="dl-actions">
                  <button type="button" className="btn small" title="Przedłuż o 1 rok" onClick={() => extendYear(d)}>
                    +1 rok
                  </button>
                  <button type="button" className="btn small" aria-label={`Edytuj ${d.title}`} onClick={() => startEdit(d)}>
                    Edytuj
                  </button>
                  {canDel && (
                    <button type="button" className="btn small" aria-label={`Usuń ${d.title}`} onClick={() => remove(d)}>
                      ×
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
