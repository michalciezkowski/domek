import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

export type Member = { name: string; color: string; admin?: boolean };
type State =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "notMember"; user: User }
  | { status: "member"; user: User; member: Member };

const Ctx = createContext<State>({ status: "loading" });
export const useSession = () => useContext(Ctx);
export const email = (u: User) => (u.email ?? "").toLowerCase();
export const login = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [member, setMember] = useState<Member | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setMember(undefined); }), []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "members", email(user));
    return onSnapshot(
      ref,
      (s) => {
        if (!s.exists()) return setMember(null);
        const raw = s.data() as Member & { createdAt?: unknown };
        // Konto założyciela utworzone ręcznie w Etapie 1 nie ma pola createdAt -> automatyczna flaga admin.
        const isAdmin = raw.admin === true || !("createdAt" in raw);
        if (isAdmin && raw.admin !== true) {
          setDoc(ref, { admin: true }, { merge: true }).catch(() => {});
        }
        setMember({ name: raw.name, color: raw.color, admin: isAdmin });
      },
      () => setMember(null)
    );
  }, [user]);

  let state: State = { status: "loading" };
  if (user === null) state = { status: "signedOut" };
  else if (user && member === null) state = { status: "notMember", user };
  else if (user && member) state = { status: "member", user, member };

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
