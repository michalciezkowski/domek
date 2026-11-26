// Synchronizacja Kalendarza Google (v3) przez konto usługi Firebase – zero zewnętrznych paczek npm.
import { createHash, createSign } from "node:crypto";
import { DAY, warsawNow } from "./lib.mjs";

const b64url = (s) => Buffer.from(s).toString("base64url");

export function createServiceJwt(clientEmail, privateKey, nowSec = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSec,
    exp: nowSec + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  return `${unsigned}.${signer.sign(privateKey, "base64url")}`;
}

export async function getGoogleAccessToken(account) {
  const assertion = createServiceJwt(account.client_email, account.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(`OAuth (${res.status}): ${body.error_description || body.error || "brak tokenu"}`);
  }
  return body.access_token;
}

export function minusOneDay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0)).toISOString().slice(0, 10);
}

export function warsawParts(iso) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// Zamienia surowe pozycje z Google Calendar API na spójny format w strefie Europe/Warsaw.
export function normalizeEvents(items, source, minDate, maxDate) {
  const out = [];
  for (const it of items || []) {
    if (!it || it.status === "cancelled") continue;
    const title = String(it.summary || "(Bez tytułu)").trim().slice(0, 160);
    const location = String(it.location || "").trim().slice(0, 140);

    if (it.start?.date) {
      const startDate = it.start.date;
      const rawEnd = it.end?.date ? minusOneDay(it.end.date) : startDate;
      const endDate = rawEnd < startDate ? startDate : rawEnd;
      if (endDate < minDate || startDate > maxDate) continue;
      out.push({
        id: `${source.id}:${it.id}`,
        calId: source.id,
        calName: source.name,
        color: source.color,
        title,
        location,
        allDay: true,
        startDate,
        endDate,
        startTime: "",
        endTime: "",
      });
    } else if (it.start?.dateTime) {
      const s = warsawParts(it.start.dateTime);
      const e = it.end?.dateTime ? warsawParts(it.end.dateTime) : s;
      const startDate = s.date;
      let endDate = e.date;
      if (endDate > startDate && e.time === "00:00") {
        endDate = minusOneDay(endDate);
        if (endDate < startDate) endDate = startDate;
      }
      if (endDate < minDate || startDate > maxDate) continue;
      out.push({
        id: `${source.id}:${it.id}`,
        calId: source.id,
        calName: source.name,
        color: source.color,
        title,
        location,
        allDay: false,
        startDate,
        endDate,
        startTime: s.time,
        endTime: e.time,
      });
    }
  }
  return out;
}

export function sortEvents(events) {
  return [...events].sort((a, b) =>
    a.startDate.localeCompare(b.startDate)
    || Number(b.allDay) - Number(a.allDay)
    || a.startTime.localeCompare(b.startTime)
    || a.title.localeCompare(b.title, "pl")
  );
}

async function fetchCalendarSource(token, source, timeMin, timeMax, minDate, maxDate) {
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.id)}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("maxResults", "250");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || "";
    if (res.status === 404) {
      return { events: [], error: "Nie znaleziono kalendarza lub nie udostępniono go jeszcze adresowi konta usługi." };
    }
    if (res.status === 403 && /has not been used in project|is disabled/i.test(msg)) {
      return { events: [], error: "Włącz Google Calendar API w Google Cloud Console dla projektu domek-fd940." };
    }
    if (res.status === 403) {
      return { events: [], error: "Brak uprawnień (403) – udostępnij ten kalendarz adresowi konta usługi." };
    }
    return { events: [], error: `Błąd Google Calendar API (${res.status}): ${msg.slice(0, 120)}` };
  }
  return { events: normalizeEvents(body.items ?? [], source, minDate, maxDate), error: "" };
}

const hashJson = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

export async function syncCalendars(db, account, { force = false, nowDate = new Date() } = {}) {
  const cfgRef = db.collection("settings").doc("calendar");
  const cfgSnap = await cfgRef.get();
  const cfg = cfgSnap.data() ?? {};

  // Zapisz adres konta usługi w Firestore (nie w repo), żeby aplikacja mogła pokazać przycisk „Kopiuj”.
  if (cfg.serviceEmail !== account.client_email) {
    await cfgRef.set({ serviceEmail: account.client_email }, { merge: true });
  }

  const sources = Array.isArray(cfg.sources) ? cfg.sources.filter((s) => s && typeof s.id === "string" && s.id.trim()) : [];
  const sourcesKey = hashJson(sources);

  if (sources.length === 0) {
    if (cfg.syncedSourcesKey && cfg.syncedSourcesKey !== sourcesKey) {
      await db.collection("calendar").doc("upcoming").set({ events: [], errors: {}, updatedAtMs: Date.now(), hash: "empty" });
      await cfgRef.set({ syncedSourcesKey: sourcesKey, lastSyncMs: Date.now() }, { merge: true });
    }
    return { synced: false, reason: "no-sources" };
  }

  const elapsed = Date.now() - (cfg.lastSyncMs ?? 0);
  if (!force && cfg.syncedSourcesKey === sourcesKey && elapsed < 25 * 60 * 1000) {
    return { synced: false, reason: "fresh" };
  }

  const minDate = warsawNow(nowDate).date;
  const maxDate = warsawNow(new Date(nowDate.getTime() + 35 * DAY)).date;
  const timeMin = new Date(nowDate.getTime() - DAY).toISOString();
  const timeMax = new Date(nowDate.getTime() + 36 * DAY).toISOString();

  const token = await getGoogleAccessToken(account);
  const results = await Promise.all(
    sources.map((s) => fetchCalendarSource(token, s, timeMin, timeMax, minDate, maxDate))
  );

  const allEvents = sortEvents(results.flatMap((r) => r.events)).slice(0, 500);
  const errors = {};
  sources.forEach((s, idx) => {
    if (results[idx].error) errors[s.id] = results[idx].error;
  });

  const payloadHash = hashJson({ events: allEvents, errors });
  const feedRef = db.collection("calendar").doc("upcoming");
  const prevHash = cfg.feedHash ?? "";

  if (force || payloadHash !== prevHash) {
    await feedRef.set({
      events: allEvents,
      errors,
      updatedAtMs: Date.now(),
      hash: payloadHash,
    });
  }
  await cfgRef.set({
    syncedSourcesKey: sourcesKey,
    lastSyncMs: Date.now(),
    feedHash: payloadHash,
  }, { merge: true });

  return { synced: true, eventsCount: allEvents.length, errorsCount: Object.keys(errors).length };
}
