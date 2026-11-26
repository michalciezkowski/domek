import { useEffect, useState } from "react";
import { login, logout, useSession } from "./session";
import Settings from "./Settings";
import Shopping from "./Shopping";
import Tasks from "./Tasks";
import { syncPush } from "./push";
import "./stage2.css";
import "./stage3.css";

const TABS = [
  { id: "today", label: "Dziś", hint: "Wydarzenia, Twoje zadania, terminy i obiad pojawią się tutaj (etap 4)." },
  { id: "shopping", label: "Zakupy", hint: "" },
  { id: "tasks", label: "Zadania", hint: "" },
  { id: "calendar", label: "Kalendarz", hint: "Wydarzenia z Kalendarza Google (etap 4)." },
  { id: "food", label: "Jedzenie", hint: "Przepisy i plan posiłków (etap 6)." },
  { id: "more", label: "Więcej", hint: "" },
] as const;

type TabId = (typeof TABS)[number]["id"];
const fromHash = (): TabId => TABS.find((t) => t.id === location.hash.slice(1))?.id ?? "today";

export default function App() {
  const s = useSession();
  const [tab, setTab] = useState<TabId>(fromHash);
  const uid = s.status === "member" ? s.user.uid : "";

  // Klik w powiadomienie otwiera /#shopping itd.
  useEffect(() => {
    const f = () => setTab(fromHash());
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  const go = (id: TabId) => { history.replaceState(null, "", "#" + id); setTab(id); };

  // Tokeny FCM się rotują: przy starcie odśwież token, jeśli powiadomienia są włączone na tym telefonie.
  useEffect(() => {
    if (s.status === "member") syncPush(s.user).catch((e) => console.warn("Push:", e?.message ?? e));
  }, [uid]);

  if (s.status === "loading") return <Center><p>Ładowanie…</p></Center>;

  if (s.status === "signedOut")
    return (
      <Center>
        <h1 className="brand">Domek</h1>
        <p>Zakupy, zadania i kalendarz całej rodziny.</p>
        <button className="btn primary" onClick={login}>Zaloguj się kontem Google</button>
      </Center>
    );

  if (s.status === "notMember")
    return (
      <Center>
        <h1 className="brand">Brak dostępu</h1>
        <p>Konto <b>{s.user.email}</b> nie jest na liście domowników. Poproś kogoś z rodziny, żeby dodał ten adres w zakładce Więcej.</p>
        <button className="btn" onClick={logout}>Zaloguj się innym kontem</button>
      </Center>
    );

  const current = TABS.find((t) => t.id === tab)!;
  return (
    <div className="shell">
      <header className="top">
        <h1>{current.label}</h1>
        <span className="me" style={{ background: s.member.color }}>{s.member.name.slice(0, 1)}</span>
      </header>
      <main className="main">
        {tab === "more" ? <Settings />
          : tab === "shopping" ? <Shopping />
          : tab === "tasks" ? <Tasks />
          : <p className="empty">{current.hint}</p>}
      </main>
      <nav className="tabs" aria-label="Główna nawigacja">
        {TABS.map((t) => (
          <button key={t.id} aria-current={t.id === tab} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="center">{children}</div>;
}
