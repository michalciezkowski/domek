import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";

export type Member = { name: string; color: string };
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
    return onSnapshot(
      doc(db, "members", email(user)),
      (s) => setMember(s.exists() ? (s.data() as Member) : null),
      () => setMember(null)
    );
  }, [user]);

  let state: State = { status: "loading" };
  if (user === null) state = { status: "signedOut" };
  else if (user && member === null) state = { status: "notMember", user };
  else if (user && member) state = { status: "member", user, member };

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
