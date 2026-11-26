import { today, useCollection } from "./data";
import { email, useSession } from "./session";
import { completeTask, dueInfo, repeatLabel, Task } from "./Tasks";
import {
  addDays,
  CalEvent,
  eventsForDay,
  eventTimeLabel,
  fmtDayHeading,
  useCalendarFeed,
  useCalendarSettings,
} from "./calendarData";

type NavTarget = "shopping" | "tasks" | "calendar" | "more";
type ShopItem = { name: string; done: boolean };

export default function Today({ onNavigate }: { onNavigate: (tab: NavTarget) => void }) {
  const s = useSession();
  const tasks = useCollection<Task>("tasks");
  const shopping = useCollection<ShopItem>("shopping");
  const calCfg = useCalendarSettings();
  const feed = useCalendarFeed();

  if (s.status !== "member") return null;
  const myId = email(s.user);
  const todayYmd = today();
  const tomorrowYmd = addDays(todayYmd, 1);

  const hasCalendars = (calCfg.sources?.length ?? 0) > 0;
  const multiCal = (calCfg.sources?.length ?? 0) > 1;
  const todayEvents = eventsForDay(feed.events, todayYmd);
  const tomorrowEvents = eventsForDay(feed.events, tomorrowYmd);

  // Moje zadania: po terminie i na dziś na górze, potem moje zadania bez wpisanej daty.
  const myTasks = tasks
    .filter((t) => !t.done && (t.assignee === myId || !t.assignee) && (!t.due || t.due <= todayYmd))
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || a.title.localeCompare(b.title, "pl"));

  const shopLeft = shopping.filter((i) => !i.done).length;

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
            <button className="btn small" onClick={() => onNavigate("more")}>Skonfiguruj w Więcej</button>
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
                  <button className="row" role="checkbox" aria-checked={false} onClick={() => completeTask(t, myId)}>
                    <span className="check" aria-hidden />
                    <span className="grow">
                      {t.title}
                      {meta && <small className={di.late ? "late" : ""}>{meta}</small>}
                    </span>
                  </button>
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
