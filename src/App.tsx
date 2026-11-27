import { useEffect, useState } from "react";
import { login, logout, useSession } from "./session";
import Calendar, { CalendarSubTab } from "./Calendar";
import Notes from "./Notes";
import Settings from "./Settings";
import Shopping from "./Shopping";
import Tasks from "./Tasks";
import Today from "./Today";
import { syncPush } from "./push";
import "./stage2.css";
import "./stage3.css";
import "./stage4.css";
import "./stage5.css";

const TABS = [
  { id: "today", label: "Dziś", hint: "" },
  { id: "shopping", label: "Zakupy", hint: "" },
  { id: "tasks", label: "Zadania", hint: "" },
  { id: "calendar", label: "Kalendarz", hint: "" },
  { id: "food", label: "Jedzenie", hint: "Przepisy i plan posiłków (etap 6)." },
  { id: "notes", label: "Notatki", hint: "" },
] as const;

type BottomTabId = (typeof TABS)[number]["id"];
type ViewId = BottomTabId | "settings";
type RouteState = { view: ViewId; calSub: CalendarSubTab };

function parseHash(): RouteState {
  const h = location.hash.slice(1);
  if (h === "settings" || h === "more") return { view: "settings", calSub: "events" };
  if (h === "deadlines") return { view: "calendar", calSub: "deadlines" };
  const found = TABS.find((t) => t.id === h)?.id ?? "today";
  return { view: found, calSub: "events" };
}

export default function App() {
  const s = useSession();
  const [route, setRoute] = useState<RouteState>(parseHash);
  const uid = s.status === "member" ? s.user.uid : "";

  // Klik w powiadomienie otwiera /#shopping, /#tasks, /#deadlines itd.
  useEffect(() => {
    const f = () => setRoute(parseHash());
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);

  const navigate = (target: ViewId | "deadlines") => {
    if (target === "deadlines") {
      history.replaceState(null, "", "#deadlines");
      setRoute({ view: "calendar", calSub: "deadlines" });
      return;
    }
    history.replaceState(null, "", "#" + target);
    setRoute({ view: target, calSub: "events" });
  };

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
        <p>Konto <b>{s.user.email}</b> nie jest na liście domowników. Poproś właściciela domu o dopisanie tego adresu w Ustawieniach.</p>
        <button className="btn" onClick={logout}>Zaloguj się innym kontem</button>
      </Center>
    );

  const heading = route.view === "settings"
    ? "Ustawienia"
    : TABS.find((t) => t.id === route.view)!.label;
  const currentTab = TABS.find((t) => t.id === route.view);

  return (
    <div className="shell">
      <header className="top">
        <h1>{heading}</h1>
        <button
          type="button"
          className={"me me-btn" + (route.view === "settings" ? " active" : "")}
          style={{ background: s.member.color }}
          aria-label="Ustawienia i konto"
          aria-pressed={route.view === "settings"}
          title="Ustawienia i konto"
          onClick={() => navigate(route.view === "settings" ? "today" : "settings")}
        >
          {s.member.name.slice(0, 1)}
        </button>
      </header>
      <main className="main">
        {route.view === "today" ? <Today onNavigate={navigate} />
          : route.view === "shopping" ? <Shopping />
          : route.view === "tasks" ? <Tasks />
          : route.view === "calendar" ? (
            <Calendar
              initialSubTab={route.calSub}
              onSubTabChange={(sub) => {
                history.replaceState(null, "", sub === "deadlines" ? "#deadlines" : "#calendar");
                setRoute({ view: "calendar", calSub: sub });
              }}
              onNavigate={navigate}
            />
          )
          : route.view === "notes" ? <Notes />
          : route.view === "settings" ? <Settings />
          : <p className="empty">{currentTab?.hint}</p>}
      </main>
      <nav className="tabs" aria-label="Główna nawigacja">
        {TABS.map((t) => (
          <button key={t.id} aria-current={t.id === route.view} onClick={() => navigate(t.id)}>
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
