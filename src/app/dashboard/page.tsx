import type { Metadata } from "next";
import { CONFIG } from "@/lib/funnel-config";
import { getSessions, type Session } from "@/lib/db";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | Funil",
  robots: { index: false, follow: false },
};

const STEP_LABELS: Record<string, string> = {
  objetivo: "Objetivo",
  desafio: "Desafio",
  momento: "Momento",
  nome: "Nome",
  telefone: "WhatsApp",
};

function stepLabel(index: number): string {
  const step = CONFIG.steps[index];
  if (!step) return "Entrou";
  return STEP_LABELS[step.id] ?? step.title;
}

function furthestStage(session: Session): {
  label: string;
  kind: "checkout" | "offer" | "step";
} {
  if (session.checkoutClicked) return { label: "Foi pro checkout", kind: "checkout" };
  if (session.reachedResult) return { label: "Viu a oferta", kind: "offer" };
  return { label: stepLabel(session.maxStepIndex), kind: "step" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const sessions = await getSessions();
  const total = sessions.length;

  const reachedResult = sessions.filter((s) => s.reachedResult).length;
  const checkout = sessions.filter((s) => s.checkoutClicked).length;
  const whatsapp = sessions.filter((s) => s.whatsappClicked).length;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const stages = [
    ...CONFIG.steps.map((step, index) => ({
      label: stepLabel(index),
      count: sessions.filter((s) => s.maxStepIndex >= index).length,
    })),
    { label: "Viu a oferta", count: reachedResult },
    { label: "Foi pro checkout", count: checkout },
  ];

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <main className="dash">
      <div className="dash-head">
        <h1>Dashboard do Funil</h1>
        <span className="dash-sub">Método Nutrido Para Sempre · atualiza a cada carregamento</span>
      </div>

      {total === 0 ? (
        <div className="dash-empty">
          Ainda não há sessões registradas. Assim que alguém abrir o funil, os dados aparecem aqui.
        </div>
      ) : (
        <>
          <section className="dash-kpis">
            <div className="dash-kpi">
              <span className="dash-kpi-label">Entraram no funil</span>
              <span className="dash-kpi-value">{total}</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Chegaram na oferta</span>
              <span className="dash-kpi-value">{reachedResult}</span>
              <span className="dash-kpi-extra">{pct(reachedResult)}% dos que entraram</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Foram pro checkout</span>
              <span className="dash-kpi-value">{checkout}</span>
              <span className="dash-kpi-extra">{pct(checkout)}% dos que entraram</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Cliques no WhatsApp</span>
              <span className="dash-kpi-value">{whatsapp}</span>
            </div>
          </section>

          <h2 className="dash-section-title">Até onde chegaram</h2>
          <section className="dash-funnel">
            {stages.map((stage) => {
              const percent = pct(stage.count);
              return (
                <div className="dash-stage" key={stage.label}>
                  <span className="dash-stage-fill" style={{ width: `${percent}%` }} />
                  <span className="dash-stage-row">
                    <span className="dash-stage-label">{stage.label}</span>
                    <span className="dash-stage-meta">
                      <span className="dash-stage-count">{stage.count}</span> · {percent}%
                    </span>
                  </span>
                </div>
              );
            })}
          </section>

          <h2 className="dash-section-title">Respostas por pergunta</h2>
          <section className="dash-questions">
            {CONFIG.steps.map((step) => {
              if (step.type !== "single") return null;
              const answered = sessions.filter((s) => s.answers[step.id]).length;
              return (
                <div className="dash-question" key={step.id}>
                  <div className="dash-question-head">
                    <span className="dash-question-title">{step.title}</span>
                    <span className="dash-question-meta">{answered} responderam</span>
                  </div>
                  <div className="dash-funnel">
                    {step.options.map((option) => {
                      const count = sessions.filter(
                        (s) => s.answers[step.id] === option.id,
                      ).length;
                      const percent =
                        answered > 0 ? Math.round((count / answered) * 100) : 0;
                      return (
                        <div className="dash-stage" key={option.id}>
                          <span
                            className="dash-stage-fill"
                            style={{ width: `${percent}%` }}
                          />
                          <span className="dash-stage-row">
                            <span className="dash-stage-label">{option.label}</span>
                            <span className="dash-stage-meta">
                              <span className="dash-stage-count">{count}</span> · {percent}%
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          <h2 className="dash-section-title">Pessoas ({total})</h2>
          <div className="dash-table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Nome</th>
                  <th>WhatsApp</th>
                  <th>Até onde chegou</th>
                  <th>Checkout</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((session) => {
                  const stage = furthestStage(session);
                  return (
                    <tr key={session.id}>
                      <td>{formatDate(session.updatedAt)}</td>
                      <td>{session.name ?? "—"}</td>
                      <td>{session.phone ?? "—"}</td>
                      <td>
                        <span className={`dash-badge is-${stage.kind}`}>{stage.label}</span>
                      </td>
                      <td>
                        {session.checkoutClicked ? (
                          <span className="dash-yes">Sim</span>
                        ) : (
                          <span className="dash-no">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
