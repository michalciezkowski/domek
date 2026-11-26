// @ts-nocheck
// Service worker (poza tsconfig: typy DOM i WebWorker się wykluczają).
// Zastępuje workboxowy generateSW z etapu 1: precache + obsługa push z FCM.
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// /__/ to ścieżki Firebase (logowanie Google) – nie wolno ich podmieniać na index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { denylist: [/^\/__\//] }));

// Wiadomości "data-only" z crona (scripts/reminders.mjs). Sami wyświetlamy powiadomienie.
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const d = payload.data || payload;
  event.waitUntil((async () => {
    // Gdy apka jest otwarta na ekranie, listy i tak odświeżają się na żywo.
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === "visible")) return;
    await self.registration.showNotification(d.title || "Domek", {
      body: d.body || "",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      icon: "/icon-192.png",
      data: { tab: d.tab || "" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tab = event.notification.data?.tab || "";
  const url = new URL(tab ? `/#${tab}` : "/", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      await w.focus();
      try { await w.navigate(url); } catch { /* klient niekontrolowany – wystarczy fokus */ }
      return;
    }
    await self.clients.openWindow(url);
  })());
});
