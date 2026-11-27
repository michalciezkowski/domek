import { FormEvent, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useCollection } from "./data";
import { email, useSession } from "./session";
import { canDeleteTask } from "./taskRules";

type Note = {
  title: string;
  body: string;
  pinned?: boolean;
  createdBy?: string;
};

export default function Notes() {
  const s = useSession();
  const notes = useCollection<Note>("notes");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  if (s.status !== "member") return null;
  const myId = email(s.user);

  function resetForm() {
    setTitle("");
    setBody("");
    setPinned(false);
    setEditId(null);
    setOpen(false);
  }

  function startEdit(n: Note & { id: string }) {
    setEditId(n.id);
    setTitle(n.title);
    setBody(n.body);
    setPinned(!!n.pinned);
    setOpen(true);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() && !body.trim()) return;
    const payload = {
      title: title.trim() || "Notatka",
      body: body.trim(),
      pinned,
      updatedAt: serverTimestamp(),
      updatedBy: myId,
    };
    if (editId) {
      updateDoc(doc(db, "notes", editId), payload)
        .catch((err) => console.warn("Edycja notatki:", err.code));
    } else {
      addDoc(collection(db, "notes"), {
        ...payload,
        createdBy: myId,
        createdAt: serverTimestamp(),
      }).catch((err) => console.warn("Zapis notatki:", err.code));
    }
    resetForm();
  }

  function togglePin(n: Note & { id: string }) {
    updateDoc(doc(db, "notes", n.id), { pinned: !n.pinned, updatedAt: serverTimestamp() });
  }

  function remove(n: Note & { id: string }) {
    if (!canDeleteTask(n, myId) || !confirm(`Usunąć notatkę „${n.title}”?`)) return;
    deleteDoc(doc(db, "notes", n.id));
  }

  const q = search.trim().toLowerCase();
  const visible = notes
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.title.localeCompare(b.title, "pl"));

  return (
    <>
      {open ? (
        <form onSubmit={save} className="form card">
          <input
            autoFocus
            placeholder="Tytuł (np. Rozmiary butów, Filtry i żarówki)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            rows={5}
            placeholder="Treść notatki…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <label className="toggle">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Przypnij na górze listy
          </label>
          <button className="btn primary">{editId ? "Zapisz zmiany" : "Dodaj notatkę"}</button>
          <button type="button" className="btn" onClick={resetForm}>Anuluj</button>
        </form>
      ) : (
        <button className="btn primary wide" onClick={() => setOpen(true)}>Nowa notatka</button>
      )}

      {notes.length >= 3 && (
        <input
          className="search-input"
          placeholder="Szukaj w notatkach…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Szukaj w notatkach"
        />
      )}

      {visible.length === 0 ? (
        <p className="empty">
          {notes.length === 0
            ? "Brak notatek. Zapisz tu stałe informacje domowe (rozmiary, symbole filtrów, listy wyjazdowe)."
            : "Brak notatek pasujących do wyszukiwania."}
        </p>
      ) : (
        <div className="notes-grid">
          {visible.map((n) => {
            const canDel = canDeleteTask(n, myId);
            return (
              <article key={n.id} className={"note-card" + (n.pinned ? " pinned" : "")}>
                <div className="note-head">
                  <h2>
                    {n.pinned && <span className="pin-badge" title="Przypięta">📌 </span>}
                    {n.title}
                  </h2>
                  <div className="dl-actions">
                    <button
                      type="button"
                      className="btn small"
                      title={n.pinned ? "Odepnij" : "Przypnij na górze"}
                      onClick={() => togglePin(n)}
                    >
                      {n.pinned ? "Odepnij" : "Przypnij"}
                    </button>
                    <button type="button" className="btn small" onClick={() => startEdit(n)}>
                      Edytuj
                    </button>
                    {canDel && (
                      <button
                        type="button"
                        className="btn small"
                        aria-label={`Usuń ${n.title}`}
                        onClick={() => remove(n)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                {n.body && <p className="note-body">{n.body}</p>}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
