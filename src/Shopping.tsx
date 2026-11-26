import { FormEvent, useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { useCollection } from "./data";
import { email, useSession } from "./session";
import { CATS, catKey, guess } from "./categories";

type Item = { name: string; category: string; done: boolean };
// Poprawki kategorii zrobione ręcznie: nazwa produktu -> kategoria. Mają pierwszeństwo przed zgadywaniem.
type Corrections = Record<string, string>;

export default function Shopping() {
  const s = useSession();
  const items = useCollection<Item>("shopping");
  const [fixes, setFixes] = useState<Corrections>({});
  const [text, setText] = useState("");
  const [store, setStore] = useState(false);

  useEffect(
    () => onSnapshot(
      doc(db, "settings", "shopping"),
      (d) => setFixes((d.data()?.corrections ?? {}) as Corrections),
      (e) => console.warn("Firestore: settings", e.code)
    ),
    []
  );
  if (s.status !== "member") return null;
  const myId = email(s.user);

  function add(e: FormEvent) {
    e.preventDefault();
    const names = text.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!names.length) return;
    const batch = writeBatch(db);
    const open = new Set(items.filter((i) => !i.done).map((i) => i.name.toLowerCase()));
    for (const n of names) {
      const key = n.toLowerCase();
      if (open.has(key)) continue;
      open.add(key);
      batch.set(doc(collection(db, "shopping")), {
        name: n, category: fixes[catKey(n)] ?? guess(n), done: false,
        addedBy: myId, createdAt: serverTimestamp(), notified: false,
      });
    }
    setText("");
    batch.commit().catch((err) => console.warn("Zapis zakupów:", err.code));
  }

  // Zmiana kategorii zapamiętuje się na przyszłość dla tej nazwy produktu.
  function setCategory(i: Item & { id: string }, category: string) {
    const b = writeBatch(db);
    b.update(doc(db, "shopping", i.id), { category });
    b.set(doc(db, "settings", "shopping"), { corrections: { [catKey(i.name)]: category } }, { merge: true });
    b.commit().catch((err) => console.warn("Zmiana kategorii:", err.code));
  }

  const doneItems = items.filter((i) => i.done);
  const left = items.length - doneItems.length;
  const cats = [...CATS, ...Array.from(new Set(items.map((i) => i.category))).filter((c) => !CATS.includes(c))];

  async function clearDone() {
    if (!doneItems.length || !confirm(`Usunąć kupione (${doneItems.length})?`)) return;
    const b = writeBatch(db);
    doneItems.forEach((i) => b.delete(doc(db, "shopping", i.id)));
    await b.commit();
  }

  return (
    <div className={store ? "store" : ""}>
      {!store && (
        <form onSubmit={add} className="form">
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Dodaj produkty (kilka naraz po przecinku lub w nowych liniach)" />
          <button className="btn primary">Dodaj do listy</button>
        </form>
      )}
      <div className="bar">
        <span>{left ? `Do kupienia: ${left}` : "Lista jest pusta"}</span>
        <button className="btn small" onClick={() => setStore(!store)}>
          {store ? "Wróć do edycji" : "Tryb sklepu"}
        </button>
      </div>
      {cats.map((c) => {
        const group = items.filter((i) => i.category === c)
          .sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name, "pl"));
        if (!group.length) return null;
        return (
          <section key={c}>
            <h2>{c}</h2>
            <ul className="list">
              {group.map((i) => (
                <li key={i.id}>
                  <button className="row" role="checkbox" aria-checked={i.done}
                    onClick={() => updateDoc(doc(db, "shopping", i.id), { done: !i.done })}>
                    <span className={"check" + (i.done ? " on" : "")} aria-hidden>{i.done ? "✓" : ""}</span>
                    <span className={i.done ? "grow struck" : "grow"}>{i.name}</span>
                  </button>
                  {!store && (
                    <>
                      <select className="catsel" aria-label={`Kategoria: ${i.name}`} value={i.category}
                        onChange={(e) => setCategory(i, e.target.value)}>
                        {cats.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <button className="btn small" aria-label={`Usuń ${i.name}`}
                        onClick={() => deleteDoc(doc(db, "shopping", i.id))}>×</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {doneItems.length > 0 && <button className="btn" onClick={clearDone}>Usuń kupione ({doneItems.length})</button>}
    </div>
  );
}
