// Czyste funkcje dat i odliczania dla modułu Terminów (współdzielone przez UI i testy).
export function addYearsYmd(ymd: string, years: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const targetYear = y + years;
  const maxDay = new Date(Date.UTC(targetYear, m, 0)).getUTCDate();
  const clampedDay = Math.min(d, maxDay);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${targetYear}-${p(m)}-${p(clampedDay)}`;
}

export function deadlineDaysLeft(due: string, todayYmd: string): number {
  const a = new Date(todayYmd + "T12:00:00").getTime();
  const b = new Date(due + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

export function deadlineBadge(due: string, todayYmd: string): { label: string; urgent: boolean } {
  const [y, m, d] = due.split("-");
  const datePl = `${d}.${m}.${y}`;
  const diff = deadlineDaysLeft(due, todayYmd);
  if (diff < 0) return { label: `Po terminie (${Math.abs(diff)} dni) · ${datePl}`, urgent: true };
  if (diff === 0) return { label: `Dziś! · ${datePl}`, urgent: true };
  if (diff === 1) return { label: `Jutro · ${datePl}`, urgent: true };
  if (diff <= 14) return { label: `Za ${diff} dni · ${datePl}`, urgent: true };
  if (diff <= 30) return { label: `Za ${diff} dni · ${datePl}`, urgent: false };
  return { label: datePl, urgent: false };
}
