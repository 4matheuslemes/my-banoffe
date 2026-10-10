const TZ = "America/Campo_Grande";
const OFFSET = "-04:00";

export type Periodo = "hoje" | "semana" | "mes" | "tudo";

export function todayStr(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function startOf(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00${OFFSET}`).toISOString();
}

export function periodRange(p: Periodo) {
  const today = todayStr();
  let start = today;
  if (p === "tudo") start = "2000-01-01";
  if (p === "semana") {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = domingo
    start = addDays(today, -((dow + 6) % 7)); // semana começa na segunda
  }
  if (p === "mes") start = today.slice(0, 8) + "01";
  return {
    from: startOf(start),
    to: startOf(addDays(today, 1)),
    fromDate: start,
    toDate: today,
  };
}
