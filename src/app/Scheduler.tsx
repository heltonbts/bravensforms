"use client";

import { useEffect, useMemo, useState } from "react";
import { CONFIG, type QuizStep } from "@/lib/funnel-config";
import {
  buildDays,
  buildMonth,
  formatSlot,
  slotIso,
  type DaySlots,
} from "@/lib/scheduling";

const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

type Answers = Record<string, string>;
type View = "pick" | "review" | "done";

// Rótulos curtos pra revisão (mesma ideia do dashboard).
const FIELD_LABELS: Record<string, string> = {
  nome: "Nome",
  telefone: "WhatsApp",
  instagram: "Instagram",
  experiencia: "Investe em tráfego hoje",
  faturamento: "Faturamento mensal",
  investir: "Disposto a investir",
};

// Converte a resposta crua em texto legível pra revisão.
function answerText(step: QuizStep, answers: Answers): string {
  const raw = answers[step.id];
  if (!raw) return "";
  if (step.type === "single") {
    return step.options.find((o) => o.id === raw)?.label ?? raw;
  }
  if (step.id === "instagram") return `@${raw}`;
  return raw;
}

export function Scheduler({
  sessionId,
  answers,
  onScheduled,
}: {
  sessionId: string;
  answers: Answers;
  onScheduled: () => void;
}) {
  const [taken, setTaken] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("pick");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Carrega os horários já reservados pra escondê-los da agenda.
  useEffect(() => {
    let active = true;
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((data: { taken?: string[] }) => {
        if (active) setTaken(data.taken ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const days = useMemo<DaySlots[]>(() => buildDays(taken), [taken]);
  const availableDates = useMemo(
    () => new Set(days.map((d) => d.date)),
    [days],
  );

  // Mês exibido no calendário (ano + mês 0-11).
  const [viewYM, setViewYM] = useState<{ y: number; m: number } | null>(null);

  // Ao carregar, posiciona no primeiro dia disponível e abre o mês dele.
  useEffect(() => {
    if (days.length && !days.some((d) => d.date === selectedDate)) {
      const first = days[0].date;
      setSelectedDate(first);
      const [y, m] = first.split("-").map(Number);
      setViewYM({ y, m: m - 1 });
    }
  }, [days, selectedDate]);

  const month = useMemo(() => {
    if (!viewYM) return null;
    return buildMonth(viewYM.y, viewYM.m, availableDates);
  }, [viewYM, availableDates]);

  // Há algum dia disponível antes/depois do mês exibido? (controla as setas)
  const canPrev = useMemo(() => {
    if (!viewYM) return false;
    const firstOfMonth = `${viewYM.y}-${String(viewYM.m + 1).padStart(2, "0")}-01`;
    return days.some((d) => d.date < firstOfMonth);
  }, [viewYM, days]);

  const canNext = useMemo(() => {
    if (!viewYM) return false;
    const lastOfMonth = `${viewYM.y}-${String(viewYM.m + 1).padStart(2, "0")}-31`;
    return days.some((d) => d.date > lastOfMonth);
  }, [viewYM, days]);

  function shiftMonth(delta: number) {
    setViewYM((cur) => {
      if (!cur) return cur;
      const m = cur.m + delta;
      if (m < 0) return { y: cur.y - 1, m: 11 };
      if (m > 11) return { y: cur.y + 1, m: 0 };
      return { y: cur.y, m };
    });
  }

  const activeDay = days.find((d) => d.date === selectedDate);
  const chosenIso =
    selectedDate && selectedTime ? slotIso(selectedDate, selectedTime) : "";

  // Linhas da revisão: dados de contato + respostas do quiz.
  const reviewRows = useMemo(() => {
    return CONFIG.steps
      .map((step) => ({
        label: FIELD_LABELS[step.id] ?? step.title,
        value: answerText(step, answers),
      }))
      .filter((row) => row.value);
  }, [answers]);

  function pickTime(time: string) {
    setSelectedTime(time);
    setError("");
    setView("review");
  }

  async function confirm() {
    if (!chosenIso || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, slot: chosenIso, answers }),
      });

      if (res.ok) {
        onScheduled();
        setView("done");
        return;
      }

      // Conflito: alguém pegou o horário. Recarrega a agenda e volta.
      if (res.status === 409) {
        const fresh = await fetch("/api/schedule").then((r) => r.json());
        setTaken((fresh as { taken?: string[] }).taken ?? []);
        setSelectedTime("");
        setView("pick");
        setError("Esse horário acabou de ser reservado. Escolha outro, por favor.");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Não foi possível agendar. Tente novamente.");
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "done") {
    return (
      <div className="sched-done">
        <span className="sched-done-check" aria-hidden="true">
          ✓
        </span>
        <h2 className="sched-done-title">Reunião confirmada!</h2>
        <p className="sched-done-slot">{formatSlot(chosenIso)}</p>
        <p className="cta-note">
          Anote aí: nossa equipe vai te chamar no WhatsApp para confirmar. Até lá! 👊
        </p>
      </div>
    );
  }

  if (view === "review") {
    return (
      <div className="sched-review">
        <p className="sched-review-when">
          <span className="sched-review-when-label">Horário escolhido</span>
          <strong>{formatSlot(chosenIso)}</strong>
        </p>

        <p className="sched-review-intro">Confira se está tudo certo:</p>
        <dl className="sched-review-list">
          {reviewRows.map((row) => (
            <div className="sched-review-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        {error ? <p className="message">{error}</p> : null}

        <div className="actions">
          <button
            className="btn-primary"
            type="button"
            onClick={confirm}
            disabled={submitting}
          >
            {submitting ? "Confirmando..." : "Confirmar agendamento"}
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              setView("pick");
              setError("");
            }}
            disabled={submitting}
          >
            Trocar horário
          </button>
        </div>
      </div>
    );
  }

  // view === "pick"
  return (
    <div className="sched-pick">
      {loading ? (
        <p className="sched-loading">Carregando horários disponíveis...</p>
      ) : days.length === 0 ? (
        <p className="sched-loading">
          Sem horários abertos no momento. Recarregue a página mais tarde.
        </p>
      ) : (
        <>
          {error ? <p className="message">{error}</p> : null}

          <span className="sched-label">Selecione uma data</span>
          <div className="sched-cal">
            <div className="sched-cal-head">
              <button
                type="button"
                className="sched-cal-nav"
                onClick={() => shiftMonth(-1)}
                disabled={!canPrev}
                aria-label="Mês anterior"
              >
                ‹
              </button>
              <span className="sched-cal-month">{month?.label}</span>
              <button
                type="button"
                className="sched-cal-nav"
                onClick={() => shiftMonth(1)}
                disabled={!canNext}
                aria-label="Próximo mês"
              >
                ›
              </button>
            </div>

            <div className="sched-cal-grid sched-cal-weekdays">
              {WEEKDAY_LABELS.map((w) => (
                <span key={w} className="sched-cal-weekday">
                  {w}
                </span>
              ))}
            </div>

            <div className="sched-cal-grid">
              {month?.weeks.flat().map((cell, i) => (
                <button
                  key={`${cell.date}-${i}`}
                  type="button"
                  className={`sched-cal-day${
                    cell.available ? " is-free" : ""
                  }${cell.date === selectedDate ? " is-selected" : ""}${
                    !cell.inMonth ? " is-muted" : ""
                  }`}
                  disabled={!cell.available}
                  onClick={() => {
                    setSelectedDate(cell.date);
                    setSelectedTime("");
                  }}
                >
                  {cell.day}
                </button>
              ))}
            </div>

            <span className="sched-cal-tz">🌎 Horário de Brasília</span>
          </div>

          {activeDay ? (
            <>
              <span className="sched-label sched-day-label">
                {activeDay.label}
              </span>
              <div className="sched-times">
                {activeDay.times.map((time) => (
                  <button
                    key={time}
                    type="button"
                    className="sched-time"
                    onClick={() => pickTime(time)}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
