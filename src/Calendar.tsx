import { useEffect, useState } from "react";
import { today } from "./data";
import { useSession } from "./session";
import Deadlines from "./Deadlines";
import {
  addDays,
  eventsForDay,
  eventTimeLabel,
  fmtDayHeading,
  useCalendarFeed,
  useCalendarSettings,
} from "./calendarData";

const HORIZON_DAYS = 35;
export type CalendarSubTab = "events" | "deadlines";

export default function Calendar({
  initialSubTab = "events",
  onSubTabChange,
  onNavigate,
}: {
  initialSubTab?: CalendarSubTab;
  onSubTabChange?: (sub: CalendarSubTab) => void;
  onNavigate: (tab: "settings") => void;
}) {
  const s = useSession();
  const cfg = useCalendarSettings();
  const feed = useCalendarFeed();
  const [sub, setSub] = useState<CalendarSubTab>(initialSubTab);
  const [calFilter, setCalFilter] = useState<string>("all");

  useEffect(() => { setSub(initialSubTab); }, [initialSubTab]);

  if (s.status !== "member") return null;
  const isAdmin = s.member.admin === true;
  const sources = cfg.sources ?? [];
  const todayYmd = today();

  function switchSub(next: CalendarSubTab) {
    setSub(next);
    onSubTabChange?.(next);
  }

  return (
    <>
      <div className="chips" role="group" aria-label="Widok kalendarza i terminów">
        <button aria-pressed={sub === "events"} onClick={() => switchSub("events")}>Wydarzenia</button>
        <button aria-pressed={sub === "deadlines"} onClick={() => switchSub("deadlines")}>Terminy</button>
      </div>

      {sub === "deadlines" ? (
        <Deadlines />
      ) : sources.length === 0 ? (
        <div className="hint-box">
          <p>Brak podpiętych kalendarzy Google.</p>
          {isAdmin && (
            <button className="btn primary" onClick={() => onNavigate("settings")}>
              Podłącz w Ustawieniach
            </button>
          )}
        </div>
      ) : (
        <EventsAgenda
          sources={sources}
          events={feed.events}
          errors={feed.errors}
          updatedAtMs={feed.updatedAtMs}
          calFilter={calFilter}
          setCalFilter={setCalFilter}
          todayYmd={todayYmd}
          isAdmin={isAdmin}
          onOpenSettings={() => onNavigate("settings")}
        />
      )}
    </>
  );
}

function EventsAgenda({
  sources,
  events,
  errors,
  updatedAtMs,
  calFilter,
  setCalFilter,
  todayYmd,
  isAdmin,
  onOpenSettings,
}: {
  sources: { id: string; name: string; color: string }[];
  events: ReturnType<typeof useCalendarFeed>["events"];
  errors: Record<string, string>;
  updatedAtMs: number;
  calFilter: string;
  setCalFilter: (v: string) => void;
  todayYmd: string;
  isAdmin: boolean;
  onOpenSettings: () => void;
}) {
  const errEntries = Object.entries(errors);
  const filteredEvents = calFilter === "all"
    ? events
    : events.filter((e) => e.calId === calFilter);

  const days: string[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = addDays(todayYmd, i);
    if (eventsForDay(filteredEvents, d).length > 0) days.push(d);
  }

  const syncLabel = updatedAtMs
    ? new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        .format(new Date(updatedAtMs))
    : "oczekuje na pierwszy przebieg crona (~10 min)";

  return (
    <>
      {sources.length > 1 && (
        <div className="chips wrap" role="group" aria-label="Filtr kalendarzy">
          <button aria-pressed={calFilter === "all"} onClick={() => setCalFilter("all")}>Wszystkie</button>
          {sources.map((s) => (
            <button key={s.id} aria-pressed={calFilter === s.id} onClick={() => setCalFilter(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      {errEntries.length > 0 && isAdmin && (
        <div className="hint-box warn" role="alert">
          <p><b>Problem z synchronizacją kalendarza:</b></p>
          {errEntries.map(([id, msg]) => {
            const name = sources.find((s) => s.id === id)?.name ?? id;
            return <p key={id}><small><b>{name}:</b> {msg}</small></p>;
          })}
          <button className="btn small" onClick={onOpenSettings}>Sprawdź w Ustawieniach</button>
        </div>
      )}

      {days.length === 0 ? (
        <p className="empty">Brak nadchodzących wydarzeń w najbliższych {HORIZON_DAYS} dniach.</p>
      ) : (
        days.map((ymd) => {
          const list = eventsForDay(filteredEvents, ymd);
          return (
            <section key={ymd} className="cal-day">
              <h2>{fmtDayHeading(ymd, todayYmd)}</h2>
              <ul className="list">
                {list.map((e) => {
                  const sub = [sources.length > 1 && calFilter === "all" ? e.calName : "", e.location]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={e.id + ":" + ymd} className="ev-row">
                      <span className="dot" style={{ background: e.color }} title={e.calName} />
                      <span className="ev-time">{eventTimeLabel(e, ymd)}</span>
                      <span className="grow">
                        {e.title}
                        {sub && <small>{sub}</small>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}

      <p className="sync-meta">Synchronizacja: {syncLabel}</p>
    </>
  );
}
