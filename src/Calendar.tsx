import { useState } from "react";
import { today } from "./data";
import {
  addDays,
  eventsForDay,
  eventTimeLabel,
  fmtDayHeading,
  useCalendarFeed,
  useCalendarSettings,
} from "./calendarData";

const HORIZON_DAYS = 35;

export default function Calendar({ onNavigate }: { onNavigate: (tab: "more") => void }) {
  const cfg = useCalendarSettings();
  const feed = useCalendarFeed();
  const [calFilter, setCalFilter] = useState<string>("all");

  const sources = cfg.sources ?? [];
  const todayYmd = today();

  if (sources.length === 0) {
    return (
      <div className="hint-box">
        <p>Brak podpiętych kalendarzy Google. Dodaj wspólny kalendarz rodzinny w zakładce <b>Więcej</b>.</p>
        <button className="btn primary" onClick={() => onNavigate("more")}>Przejdź do ustawień</button>
      </div>
    );
  }

  const errEntries = Object.entries(feed.errors);
  const filteredEvents = calFilter === "all"
    ? feed.events
    : feed.events.filter((e) => e.calId === calFilter);

  const days: string[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const d = addDays(todayYmd, i);
    if (eventsForDay(filteredEvents, d).length > 0) days.push(d);
  }

  const syncLabel = feed.updatedAtMs
    ? new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        .format(new Date(feed.updatedAtMs))
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

      {errEntries.length > 0 && (
        <div className="hint-box warn" role="alert">
          <p><b>Problem z synchronizacją kalendarza:</b></p>
          {errEntries.map(([id, msg]) => {
            const name = sources.find((s) => s.id === id)?.name ?? id;
            return <p key={id}><small><b>{name}:</b> {msg}</small></p>;
          })}
          <button className="btn small" onClick={() => onNavigate("more")}>Sprawdź w Więcej</button>
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
