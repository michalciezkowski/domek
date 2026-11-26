// Czysta logika przypomnień (bez wejścia/wyjścia) – łatwa do przetestowania.
export const DAY = 24 * 3600 * 1000;

// Data i godzina w Warszawie (runner GitHuba działa w UTC).
export function warsawNow(date = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    }).formatToParts(date).map((x) => [x.type, x.value])
  );
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
export const quiet = (hour) => hour < 7 || hour >= 22; // cisza nocna: nic nie wysyłamy

const wants = (dev, key) => !!dev && dev.prefs?.[key] !== false;
export const isNewTask = (t) => t.notified !== true && !!t.assignee && t.assignee !== t.createdBy;
export const isDue = (t, today) => !!t.due && t.due <= today && t.remindedFor !== t.due && !!t.assignee;
export const hasWork = (shopping, tasks, today) =>
  shopping.length > 0 || tasks.some((t) => t.notified !== true || isDue(t, today));

// "a, b, c" skrócone do ~max znaków, z "+N" na końcu.
export function clip(items, max = 110) {
  let out = "", used = 0;
  for (const it of items) {
    const next = out ? `${out}, ${it}` : it;
    if (next.length > max && used > 0) break;
    out = next; used++;
  }
  return items.length > used ? `${out} +${items.length - used}` : out;
}

// shopping: nowe pozycje (notified=false); tasks: aktywne zadania;
// devices: { email: { tokens, prefs } }; names: { email: imię }.
export function plan({ shopping, tasks, devices, names, today, nowMs }) {
  const name = (e) => names[e] || String(e).split("@")[0];
  const messages = [];
  const send = (to, key, m) => { if (wants(devices[to], key)) messages.push({ to, ...m }); };

  // Zakupy: każdy dostaje to, co dodał KTOŚ INNY.
  const fresh = shopping.filter((i) => !i.done);
  for (const to of Object.keys(devices)) {
    const by = {};
    for (const i of fresh) if (i.addedBy !== to) (by[i.addedBy] ??= []).push(i.name);
    const parts = Object.entries(by).map(([who, list]) => `${name(who)}: ${clip(list, 60)}`);
    if (parts.length) send(to, "shopping", { title: "Lista zakupów", body: parts.join(" · "), tag: "shopping", tab: "shopping" });
  }

  // Zadania: nowe przypisane przez kogoś innego + termin dziś lub po terminie.
  const dueBy = {}, newBy = {}, taskPatches = [];
  for (const t of tasks) {
    const patch = {};
    const due = isDue(t, today);
    // Zadanie, które ktoś właśnie sam sobie założył na dziś, nie wymaga przypomnienia.
    const justMine = t.assignee === t.createdBy && t.createdMs && nowMs - t.createdMs < 6 * 3600 * 1000;
    if (due) { patch.remindedFor = t.due; if (!justMine) (dueBy[t.assignee] ??= []).push(t); }
    if (t.notified !== true) { patch.notified = true; if (isNewTask(t) && !due) (newBy[t.assignee] ??= []).push(t); }
    if (Object.keys(patch).length) taskPatches.push({ id: t.id, patch });
  }
  for (const [to, list] of Object.entries(newBy)) {
    const by = {};
    for (const t of list) (by[t.createdBy] ??= []).push(t.title);
    const body = Object.entries(by).map(([who, l]) => `${name(who)}: ${clip(l, 60)}`).join(" · ");
    send(to, "tasks", { title: "Nowe zadanie", body, tag: "tasks-new", tab: "tasks" });
  }
  for (const [to, list] of Object.entries(dueBy)) {
    const todays = list.filter((t) => t.due === today).map((t) => t.title);
    const late = list.filter((t) => t.due < today).map((t) => t.title);
    const body = [todays.length && `Na dziś: ${clip(todays, 70)}`, late.length && `Po terminie: ${clip(late, 70)}`].filter(Boolean).join(" · ");
    send(to, "tasks", { title: "Zadania", body, tag: "tasks-due", tab: "tasks" });
  }

  return { messages, shoppingIds: shopping.map((i) => i.id), taskPatches };
}
