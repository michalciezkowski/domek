import { today, useCollection, useMembers } from "./data";
import { email, useSession } from "./session";
import { completeTask, dueInfo, repeatLabel, Task } from "./Tasks";
import { Deadline } from "./Deadlines";
import { deadlineBadge, deadlineDaysLeft } from "./deadlineUtils";
import {
  addDays,
  CalEvent,
  eventsForDay,
  eventTimeLabel,
  fmtDayHeading,
  useCalendarFeed,
  useCalendarSettings,
} from "./calendarData";

type NavTarget = "shopping" | "tasks" | "calendar" | "deadlines" | "settings";
type ShopItem = { name: string; done: boolean };

export default function Today({ onNavigate }: { onNavigate: (tab: NavTarget) => void }) {
  const s = useSession();
  const tasks = useCollection<Task>("tasks");
  const shopping = useCollection<ShopItem>("shopping");
  const deadlines = useCollection<Deadline>("deadlines");
  const members = useMembers();
  const calCfg = useCalendarSettings();
  const feed = useCalendarFeed();

  if (s.status !== "member") return null;
  const myId = email(s.user);
  const isAdmin = s.member.admin === true;
  const todayYmd = today();
  const tomorrowYmd = addDays(todayYmd, 1);

  const hasCalendars = (calCfg.sources?.length ?? 0) > 0;
  const multiCal = (calCfg.sources?.length ?? 0) > 1;
  const todayEvents = eventsForDay(feed.events, todayYmd);
  const tomorrowEvents = eventsForDay(feed.events, tomorrowYmd);

  // Zbliżające się terminy dokumentów/umów (<= 30 dni lub po terminie).
  const soonDeadlines = deadlines
    .filter((d) => d.due && deadlineDaysLeft(d.due, todayYmd) <= 30)
    .sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, "pl"));

  // Moje zadania: po terminie i na dziś na górze, potem moje zadania bez wpisanej daty.
  const myTasks = tasks
    .filter((t) => !t.done && (t.assignee === myId || !t.assignee) && (!t.due || t.due <= todayYmd))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title, "pl"));

  const shopLeft = shopping.filter((i) => !i.done).length;
  const who = (id: string) => members.find((m) => m.id === id);

  return (
    <>
      <p className="day-sub">{fmtDayHeading(todayYmd, todayYmd).replace(/^Dziś · /, "")}</p>

      {shopLeft > 0 && (
        <button className="shortcut" onClick={() => onNavigate("shopping")}>
          <span>Lista zakupów: <b>{shopLeft}</b> do kupienia</span>
          <span aria-hidden>→</span>
        </button>
      )}

      <section>
        <div className="sec-head">
          <h2>Wydarzenia dziś</h2>
          {hasCalendars && (
            <button className="link-btn" onClick={() => onNavigate("calendar")}>Kalendarz →</button>
          )}
        </div>

        {!hasCalendars ? (
          <div className="hint-box">
            <p>Kalendarz Google nie jest jeszcze podpięty.</p>
            {isAdmin && (
              <button className="btn small" onClick={() => onNavigate("settings")}>Podłącz w Ustawieniach</button>
            )}
          </div>
        ) : todayEvents.length === 0 ? (
          <p className="empty-inline">Dziś brak zaplanowanych wydarzeń.</p>
        ) : (
          <EventList events={todayEvents} ymd={todayYmd} showCalName={multiCal} />
        )}

        {tomorrowEvents.length > 0 && (
          <div className="sub-sec">
            <h3>Jutro</h3>
            <EventList events={tomorrowEvents} ymd={tomorrowYmd} showCalName={multiCal} />
          </div>
        )}
      </section>

      {soonDeadlines.length > 0 && (
        <section>
          <div className="sec-head">
            <h2>Zbliżające się terminy</h2>
            <button className="link-btn" onClick={() => onNavigate("deadlines")}>Terminy →</button>
          </div>
          <ul className="list">
            {soonDeadlines.map((d) => {
              const b = deadlineBadge(d.due, todayYmd);
              const p = d.owner ? who(d.owner) : undefined;
              return (
                <li key={d.id}>
                  {p && <span className="dot" style={{ background: p.color }} title={p.name} />}
                  <span className="grow">
                    {d.title}
                    <small className={b.urgent ? "late" : ""}>
                      {[b.label, p ? p.name : ""].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <div className="sec-head">
          <h2>Twoje zadania</h2>
          <button className="link-btn" onClick={() => onNavigate("tasks")}>Wszystkie →</button>
        </div>

        {myTasks.length === 0 ? (
          <p className="empty-inline">Brak zadań na dziś — wszystko ogarnięte.</p>
        ) : (
          <ul className="list">
            {myTasks.map((t) => {
              const di = dueInfo(t.due);
              const rl = repeatLabel(t.repeat);
              const meta = [di.text, rl].filter(Boolean).join(", ");
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    className="check-btn"
                    role="checkbox"
                    aria-checked={false}
                    aria-label={`Oznacz jako zrobione: ${t.title}`}
                    onClick={() => completeTask(t, myId)}
                  >
                    <span className="check" aria-hidden />
                  </button>
                  <span className="task-body grow">
                    {t.title}
                    {meta && <small className={di.late ? "late" : ""}>{meta}</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function EventList({ events, ymd, showCalName }: { events: CalEvent[]; ymd: string; showCalName: boolean }) {
  return (
    <ul className="list">
      {events.map((e) => {
        const sub = [showCalName ? e.calName : "", e.location].filter(Boolean).join(" · ");
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
  );
}
