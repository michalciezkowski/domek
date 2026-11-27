import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catKey, guess } from "../src/categories.ts";
import { canCompleteTask, canDeleteTask } from "../src/taskRules.ts";
import { addYearsYmd, deadlineBadge } from "../src/deadlineUtils.ts";
import { clip, hasWork, plan, quiet, warsawNow } from "../scripts/lib.mjs";
import { minusOneDay, normalizeEvents, sortEvents } from "../scripts/gcal.mjs";

describe("categories.ts – kategoryzacja produktów", () => {
  it("rozpoznaje polskie rdzenie słów i zachowuje priorytety reguł", () => {
    assert.equal(guess("sok pomarańczowy"), "Napoje");
    assert.equal(guess("pomarańcze"), "Warzywa i owoce");
    assert.equal(guess("sos pomidorowy"), "Produkty suche");
    assert.equal(guess("pomidory malinowe"), "Warzywa i owoce");
    assert.equal(guess("proszek do pieczenia"), "Produkty suche");
    assert.equal(guess("proszek do prania"), "Chemia i higiena");
    assert.equal(guess("mleko 3.2%"), "Nabiał");
    assert.equal(guess("baterie AA"), "Inne");
  });

  it("normalizuje klucz korekty bez znaków specjalnych Firestore", () => {
    assert.equal(catKey("  Mleko 3.2% (UHT) "), "mleko 3_2_ _uht_");
  });
});

describe("scripts/lib.mjs – czysta logika crona przypomnień", () => {
  it("wykrywa ciszę nocną 22:00–06:59 i strefę Europe/Warsaw", () => {
    assert.equal(quiet(22), true);
    assert.equal(quiet(6), true);
    assert.equal(quiet(7), false);
    assert.equal(quiet(21), false);
    const w = warsawNow(new Date("2026-06-15T06:30:00Z")); // CEST = UTC+2 -> 08:30
    assert.equal(w.date, "2026-06-15");
    assert.equal(w.hour, 8);
  });

  it("wysyła zakupy tylko do innych domowników z włączoną preferencją", () => {
    const res = plan({
      shopping: [
        { id: "s1", name: "Mleko", addedBy: "anna@example.com", done: false },
        { id: "s2", name: "Chleb", addedBy: "jan@example.com", done: false },
      ],
      tasks: [],
      devices: {
        "anna@example.com": { tokens: ["t1"], prefs: { shopping: true } },
        "jan@example.com": { tokens: ["t2"], prefs: { shopping: true } },
        "cichy@example.com": { tokens: ["t3"], prefs: { shopping: false } },
      },
      names: { "anna@example.com": "Anna", "jan@example.com": "Jan" },
      today: "2026-11-26",
      nowMs: 1_700_000_000_000,
    });

    assert.deepEqual(res.shoppingIds, ["s1", "s2"]);
    assert.equal(res.messages.length, 2);
    assert.deepEqual(res.messages.find((m) => m.to === "anna@example.com")?.body, "Jan: Chleb");
    assert.deepEqual(res.messages.find((m) => m.to === "jan@example.com")?.body, "Anna: Mleko");
  });

  it("rozróżnia nowe zadania od kogoś innego, terminy na dziś i tłumi własne świeże zadania", () => {
    const nowMs = 1_700_000_000_000;
    const tasks = [
      { id: "t1", title: "Wynieść śmieci", createdBy: "anna@example.com", assignee: "jan@example.com", due: "2026-11-28", notified: false, createdMs: nowMs - 1000 },
      { id: "t2", title: "Zadzwonić do banku", createdBy: "jan@example.com", assignee: "jan@example.com", due: "2026-11-26", notified: false, createdMs: nowMs - 60_000 },
      { id: "t3", title: "Opłacić prąd", createdBy: "jan@example.com", assignee: "jan@example.com", due: "2026-11-25", notified: true, createdMs: nowMs - 86_400_000 },
    ];

    assert.equal(hasWork([], tasks, "2026-11-26"), true);
    const res = plan({
      shopping: [],
      tasks,
      devices: { "jan@example.com": { tokens: ["t2"], prefs: { tasks: true } } },
      names: { "anna@example.com": "Anna", "jan@example.com": "Jan" },
      today: "2026-11-26",
      nowMs,
    });

    assert.equal(res.messages.length, 2);
    assert.equal(res.messages[0].title, "Nowe zadanie");
    assert.equal(res.messages[0].body, "Anna: Wynieść śmieci");
    assert.equal(res.messages[1].title, "Zadania");
    assert.equal(res.messages[1].body, "Po terminie: Opłacić prąd");
    assert.equal(res.taskPatches.length, 3);
  });

  it("skraca długie listy z sufiksem +N", () => {
    assert.equal(clip(["masło", "mleko", "chleb", "pomidory"], 15), "masło, mleko +2");
  });
});

describe("scripts/gcal.mjs – normalizacja wydarzeń Google Calendar", () => {
  const src = { id: "fam@group.calendar.google.com", name: "Rodzinny", color: "#0f766e" };

  it("przelicza exclusive end.date dla wydarzeń całodniowych i wielodniowych", () => {
    assert.equal(minusOneDay("2026-12-01"), "2026-11-30");
    const items = [
      { id: "e1", summary: "Urodziny Zosi", start: { date: "2026-11-26" }, end: { date: "2026-11-27" } },
      { id: "e2", summary: "Ferie", start: { date: "2026-11-28" }, end: { date: "2026-12-01" } },
      { id: "e3", status: "cancelled", summary: "Odwołane", start: { date: "2026-11-26" }, end: { date: "2026-11-27" } },
    ];
    const norm = normalizeEvents(items, src, "2026-11-26", "2026-12-31");
    assert.equal(norm.length, 2);
    assert.equal(norm[0].allDay, true);
    assert.equal(norm[0].startDate, "2026-11-26");
    assert.equal(norm[0].endDate, "2026-11-26");
    assert.equal(norm[1].startDate, "2026-11-28");
    assert.equal(norm[1].endDate, "2026-11-30");
  });

  it("konwertuje godziny do Europe/Warsaw, ucina północ 00:00 i sortuje całodniowe przed godzinowymi", () => {
    const items = [
      { id: "t1", summary: "Dentysta", location: "ul. Lipowa 4", start: { dateTime: "2026-11-26T15:30:00Z" }, end: { dateTime: "2026-11-26T16:15:00Z" } },
      { id: "t2", summary: "Wieczór planszówek", start: { dateTime: "2026-11-26T20:00:00+01:00" }, end: { dateTime: "2026-11-27T00:00:00+01:00" } },
      { id: "a1", summary: "Wywóz plastiku", start: { date: "2026-11-26" }, end: { date: "2026-11-27" } },
    ];
    const sorted = sortEvents(normalizeEvents(items, src, "2026-11-26", "2026-11-30"));
    assert.equal(sorted.length, 3);
    assert.equal(sorted[0].title, "Wywóz plastiku"); // całodniowe pierwsze
    assert.equal(sorted[1].title, "Dentysta");
    assert.equal(sorted[1].startTime, "16:30"); // UTC+1 w listopadzie
    assert.equal(sorted[1].endTime, "17:15");
    assert.equal(sorted[2].title, "Wieczór planszówek");
    assert.equal(sorted[2].endDate, "2026-11-26"); // koniec o 00:00 nie przechodzi na kolejny dzień
  });
});

describe("taskRules.ts – uprawnienia usuwania i zamykania zadań", () => {
  it("pozwala zamknąć zadanie tylko osobie przypisanej, a usunąć tylko autorowi", () => {
    const task = { createdBy: "michal@example.com", assignee: "anna@example.com" };
    assert.equal(canDeleteTask(task, "michal@example.com"), true);
    assert.equal(canDeleteTask(task, "anna@example.com"), false);
    assert.equal(canCompleteTask(task, "anna@example.com"), true);
    assert.equal(canCompleteTask(task, "michal@example.com"), false);
  });
});

describe("deadlineUtils.ts + lib.mjs – terminy dokumentów i przypomnienia", () => {
  it("przedłuża datę o rok bez dryfu 29 lutego i formatuje pilność", () => {
    assert.equal(addYearsYmd("2028-02-29", 1), "2029-02-28");
    assert.equal(addYearsYmd("2026-11-27", 1), "2027-11-27");
    assert.equal(deadlineBadge("2026-12-05", "2026-11-27").urgent, true);
    assert.equal(deadlineBadge("2026-12-20", "2026-11-27").urgent, false);
  });

  it("wysyła przypomnienia o terminie na progu <=14 dni oraz ponownie <=3 dni", () => {
    const devices = {
      "anna@example.com": { tokens: ["t1"], prefs: { tasks: true } },
      "jan@example.com": { tokens: ["t2"], prefs: { tasks: true } },
    };
    const dl14 = [{ id: "d1", title: "Polisa OC", due: "2026-12-10", owner: "" }];
    assert.equal(hasWork([], [], "2026-11-27", dl14), true);

    const r1 = plan({ shopping: [], tasks: [], deadlines: dl14, devices, names: {}, today: "2026-11-27", nowMs: 0 });
    assert.equal(r1.messages.length, 2); // wspólny termin -> obaj domownicy
    assert.equal(r1.messages[0].tab, "deadlines");
    assert.deepEqual(r1.deadlinePatches, [{ id: "d1", patch: { remindedStage: "2026-12-10:14" } }]);

    // Dzień później (12 dni przed) – nie wysyła ponownie na tym samym progu :14
    const dlAlready14 = [{ id: "d1", title: "Polisa OC", due: "2026-12-10", owner: "", remindedStage: "2026-12-10:14" }];
    assert.equal(hasWork([], [], "2026-11-28", dlAlready14), false);

    // 3 dni przed – wchodzi w próg :3 i wysyła ostatnie ostrzeżenie
    assert.equal(hasWork([], [], "2026-12-07", dlAlready14), true);
    const r2 = plan({ shopping: [], tasks: [], deadlines: dlAlready14, devices, names: {}, today: "2026-12-07", nowMs: 0 });
    assert.deepEqual(r2.deadlinePatches, [{ id: "d1", patch: { remindedStage: "2026-12-10:3" } }]);
  });
});
