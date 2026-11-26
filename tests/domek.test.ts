import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catKey, guess } from "../src/categories.ts";
import { clip, hasWork, plan, quiet, warsawNow } from "../scripts/lib.mjs";

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
      // Przypisane przez inną osobę (bez terminu na dziś) -> powiadomienie "Nowe zadanie"
      { id: "t1", title: "Wynurzyć śmieci", createdBy: "anna@example.com", assignee: "jan@example.com", due: "2026-11-28", notified: false, createdMs: nowMs - 1000 },
      // Założone samemu sobie przed chwilą na dziś -> oznacz remindedFor, ale nie wysyłaj pusha
      { id: "t2", title: "Zadzwonić do banku", createdBy: "jan@example.com", assignee: "jan@example.com", due: "2026-11-26", notified: false, createdMs: nowMs - 60_000 },
      // Przeterminowane zadanie -> powiadomienie "Po terminie"
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
    assert.equal(res.messages[0].body, "Anna: Wynurzyć śmieci");
    assert.equal(res.messages[1].title, "Zadania");
    assert.equal(res.messages[1].body, "Po terminie: Opłacić prąd");
    assert.equal(res.taskPatches.length, 3);
  });

  it("skraca długie listy z sufiksem +N", () => {
    assert.equal(clip(["masło", "mleko", "chleb", "pomidory"], 15), "masło, mleko +2");
  });
});
