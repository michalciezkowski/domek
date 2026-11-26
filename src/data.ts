import { useEffect, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "./firebase";

export function useCollection<T>(name: string) {
  const [items, setItems] = useState<(T & { id: string })[]>([]);
  useEffect(
    () => onSnapshot(
      query(collection(db, name)),
      (q) => setItems(q.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))),
      (e) => console.warn("Firestore:", name, e.code)
    ),
    [name]
  );
  return items;
}

export type MemberRow = { id: string; name: string; color: string };
export const useMembers = () => useCollection<{ name: string; color: string }>("members");

export function fmt(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const today = () => fmt(new Date());
