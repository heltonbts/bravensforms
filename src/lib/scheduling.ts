import { CONFIG } from "./funnel-config";

// Brasília é UTC-3 fixo (o Brasil não tem mais horário de verão desde 2019),
// então podemos ancorar os horários da agenda nesse offset com segurança.
const BR_OFFSET = "-03:00";
const TZ = "America/Sao_Paulo";

export type DaySlots = {
  date: string; // YYYY-MM-DD no fuso de Brasília
  label: string; // ex.: "seg., 30/06"
  times: string[]; // ["09:00", "09:30", ...] em horário de Brasília
};

// Instante absoluto (ISO/UTC) de um horário escolhido em Brasília.
export function slotIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00${BR_OFFSET}`).toISOString();
}

// Data (YYYY-MM-DD) de hoje no fuso de Brasília.
export function brasiliaToday(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TZ });
}

// Gera os dias e horários disponíveis a partir da configuração da agenda.
// `taken` são instantes (ISO) já reservados, removidos da lista. Horários que
// já passaram (no dia de hoje) também são descartados.
export function buildDays(taken: string[] = [], now = new Date()): DaySlots[] {
  const cfg = CONFIG.scheduling;
  const takenSet = new Set(taken);
  const today = brasiliaToday(now);
  // Âncora ao meio-dia de Brasília: somar 24h por dia mantém o relógio no
  // mesmo horário (sem DST), então a data e o dia da semana ficam estáveis.
  const anchor = new Date(`${today}T12:00:00${BR_OFFSET}`);
  const days: DaySlots[] = [];

  for (let d = 0; d < cfg.daysAhead; d++) {
    const dt = new Date(anchor.getTime() + d * 86_400_000);
    const date = dt.toLocaleDateString("en-CA", { timeZone: TZ });
    const weekday = dt.getUTCDay(); // meio-dia BRT = 15:00 UTC, mesmo dia
    if (!cfg.weekdays.includes(weekday)) continue;

    const times: string[] = [];
    const last = cfg.endHour * 60 - cfg.durationMinutes;
    for (let m = cfg.startHour * 60; m <= last; m += cfg.durationMinutes) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      const time = `${hh}:${mm}`;
      const iso = slotIso(date, time);
      if (takenSet.has(iso)) continue;
      if (new Date(iso).getTime() <= now.getTime()) continue; // já passou
      times.push(time);
    }

    if (times.length === 0) continue;
    days.push({
      date,
      label: dt.toLocaleDateString("pt-BR", {
        timeZone: TZ,
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      }),
      times,
    });
  }

  return days;
}

export type MonthCell = {
  date: string; // YYYY-MM-DD
  day: number; // dia do mês
  inMonth: boolean; // pertence ao mês exibido (vs. dia de preenchimento)
  available: boolean; // tem horário livre
};

export type MonthView = {
  year: number;
  month: number; // 0-11
  label: string; // ex.: "Junho 2026"
  weeks: MonthCell[][]; // semanas (dom..sáb)
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Monta a grade de um mês (semanas dom→sáb), marcando os dias com horário livre.
// `available` é o conjunto de datas (YYYY-MM-DD) que têm slots.
export function buildMonth(
  year: number,
  month: number,
  available: Set<string>,
): MonthView {
  const first = new Date(Date.UTC(year, month, 1));
  const startWeekday = first.getUTCDay(); // 0 = domingo
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysInPrev = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: MonthCell[] = [];
  // Dias do mês anterior pra completar a primeira semana.
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ date: ymd(py, pm, d), day: d, inMonth: false, available: false });
  }
  // Dias do mês atual.
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ymd(year, month, d);
    cells.push({ date, day: d, inMonth: true, available: available.has(date) });
  }
  // Completa a última semana com o mês seguinte.
  while (cells.length % 7 !== 0) {
    const idx = cells.length - (startWeekday + daysInMonth) + 1;
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ date: ymd(ny, nm, idx), day: idx, inMonth: false, available: false });
  }

  const weeks: MonthCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, label: `${MONTH_NAMES[month]} ${year}`, weeks };
}

// Rótulo completo de um slot, pra revisão/confirmação e dashboard.
// ex.: "segunda-feira, 30 de junho · 09:00"
export function formatSlot(iso: string): string {
  const dia = new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const hora = new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dia} · ${hora}`;
}
