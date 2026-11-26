import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { fmt } from "./data";

export type CalSource = { id: string; name: string; color: string };
export type CalEvent = {
  id: string;
  calId: string;
  calName: string;
  color: string;
  title: string;
  location: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export type CalendarSettingsDoc = {
  serviceEmail?: string;
  sources?: CalSource[];
  lastSyncMs?: number;
};

export type CalendarFeedDoc = {
  events: CalEvent[];
  errors: Record<string, string>;
  updatedAtMs: number;
};

export function useCalendarSettings(): CalendarSettingsDoc {
  const [cfg, setCfg] = useState<CalendarSettingsDoc>({});
  useEffect(
    () => onSnapshot(
      doc(db, "settings", "calendar"),
      (d) => setCfg((d.data() as CalendarSettingsDoc) ?? {}),
      (e) => console.warn("Firestore: settings/calendar", e.code)
    ),
    []
  );
  return cfg;
}

export function useCalendarFeed(): CalendarFeedDoc {
  const [feed, setFeed] = useState<CalendarFeedDoc>({ events: [], errors: {}, updatedAtMs: 0 });
  useEffect(
    () => onSnapshot(
      doc(db, "calendar", "upcoming"),
      (d) => {
        const v = d.data();
        setFeed({
          events: (v?.events as CalEvent[]) ?? [],
          errors: (v?.errors as Record<string, string>) ?? {},
          updatedAtMs: (v?.updatedAtMs as number) ?? 0,
        });
      },
      (e) => console.warn("Firestore: calendar/upcoming", e.code)
    ),
    []
  );
  return feed;
}

export function addDays(ymd: string, delta: number): string {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return fmt(d);
}

export function eventsForDay(events: CalEvent[], ymd: string): CalEvent[] {
  return events
    .filter((e) => e.startDate <= ymd && ymd <= e.endDate)
    .sort((a, b) =>
      Number(b.allDay) - Number(a.allDay)
      || a.startTime.localeCompare(b.startTime)
      || a.title.localeCompare(b.title, "pl")
    );
}

export function eventTimeLabel(e: CalEvent, ymd: string): string {
  if (e.allDay) {
    if (e.startDate === e.endDate) return "Cały dzień";
    const start = new Date(e.startDate + "T12:00:00").getTime();
    const end = new Date(e.endDate + "T12:00:00").getTime();
    const cur = new Date(ymd + "T12:00:00").getTime();
    const dayIdx = Math.round((cur - start) / 86400000) + 1;
    const total = Math.round((end - start) / 86400000) + 1;
    return `Cały dzień (${dayIdx}/${total})`;
  }
  if (e.startDate === e.endDate) {
    return e.endTime && e.endTime !== e.startTime ? `${e.startTime}–${e.endTime}` : e.startTime;
  }
  if (ymd === e.startDate) return `od ${e.startTime}`;
  if (ymd === e.endDate) return `do ${e.endTime}`;
  return "Cały dzień";
}

export function fmtDayHeading(ymd: string, todayYmd: string): string {
  const d = new Date(ymd + "T12:00:00");
  const full = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" }).format(d);
  const cap = full.charAt(0).toUpperCase() + full.slice(1);
  if (ymd === todayYmd) return `Dziś · ${cap}`;
  if (ymd === addDays(todayYmd, 1)) return `Jutro · ${cap}`;
  return cap;
}
